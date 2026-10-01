/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseSerialReturn {
  isConnected: boolean;
  connect: (customBaudRate?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  resetAndReconnect: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  baudRate: number;
  setBaudRate: (rate: number) => void;
  isIframe: boolean;
}

/**
 * Web Serial API를 활용하여 하드웨어(ESP32 등)와 통신하는 커스텀 훅
 * W3C Web Serial 표준 규약 준수 및 스트림 락 안전 해제 로직 적용
 */
export function useSerial(onDataReceived: (data: string) => void): UseSerialReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isReadingRef = useRef(false);
  const readLoopPromiseRef = useRef<Promise<void> | null>(null);
  const isDisconnectingRef = useRef(false);

  // iframe 내부 여부 감지 (AI Studio 미리보기 등)
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 시리얼 포트 연결 해제 (W3C Web Serial 표준 규약 준수)
  const disconnect = useCallback(async () => {
    if (isDisconnectingRef.current) return;
    isDisconnectingRef.current = true;
    isReadingRef.current = false;
    
    // 1. 활성 리더 스트림 취소 (reader.read() 루프 즉시 종료 유도)
    const reader = readerRef.current;
    if (reader) {
      try {
        await reader.cancel();
      } catch (err) {
        // 이미 캔슬되었거나 연결 종료된 경우 무시
      }
    }

    // 2. readLoop가 완전히 종료되고 reader.releaseLock()이 완료될 때까지 대기
    if (readLoopPromiseRef.current) {
      try {
        await readLoopPromiseRef.current;
      } catch (err) {
        // ignore
      }
      readLoopPromiseRef.current = null;
    }

    // 3. 물리 포트 인스턴스 닫기 (브라우저 OS 핸들 완전 해제)
    const port = portRef.current;
    portRef.current = null;
    if (port) {
      try {
        await port.close();
      } catch (err) {
        // 이미 닫혔거나 OS에서 분리된 경우 무시
      }
    }

    // 4. 브라우저에 남아있을 수 있는 미닫힌 포트 핸들 추가 정리
    try {
      const nav = navigator as any;
      if (nav?.serial?.getPorts) {
        const allPorts = await nav.serial.getPorts();
        for (const p of allPorts) {
          if (p.readable && !p.readable.locked) {
            try { await p.close(); } catch (e) {}
          }
        }
      }
    } catch (e) {
      // ignore
    }
    
    setIsConnected(false);
    isDisconnectingRef.current = false;
  }, []);

  // 데이터 읽기 루프
  const readLoop = useCallback(async (portToRead: any) => {
    if (!portToRead) return;

    try {
      while (portToRead.readable && isReadingRef.current) {
        let reader: any = null;
        try {
          reader = portToRead.readable.getReader();
        } catch (lockErr) {
          // 이미 락이 걸려있는 경우 루프 탈출
          break;
        }
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (isReadingRef.current) {
            const { value, done } = await reader.read();
            if (done) {
              break; // 스트림 정상 종료
            }
            if (value) {
              buffer += decoder.decode(value, { stream: true });
              
              // 개행문자(\n) 기준으로 버퍼 분할
              const lines = buffer.split('\n');
              
              // 마지막 요소는 아직 \n이 도착하지 않은 불완전 문자열이므로 버퍼에 보관
              buffer = lines.pop() || '';

              // [지연(Lag) 없는 실시간 처리: 수신된 모든 라인을 실시간 파싱]
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) {
                  onDataReceived(trimmed);
                }
              }
            }
          }
        } catch (error: any) {
          const isDeviceLost = 
            error?.name === 'NetworkError' || 
            error?.message?.includes('device has been lost') ||
            error?.message?.includes('The device has been lost');

          if (isDeviceLost) {
            setError('USB 기기 연결이 분리되었습니다. 케이블 상태를 확인하고 다시 연결해주세요.');
            setIsConnected(false);
          } else if (isReadingRef.current) {
            console.warn('Serial read warning:', error?.message || error);
          }
          break; // 에러 발생 시 읽기 루프 탈출
        } finally {
          try {
            reader.releaseLock();
          } catch (e) {
            // ignore release lock error
          }
          if (readerRef.current === reader) {
            readerRef.current = null;
          }
        }
      }
    } catch (err: any) {
      console.warn('Port readable warning:', err?.message || err);
    } finally {
      isReadingRef.current = false;
    }
  }, [onDataReceived]);

  // 시리얼 포트 연결 요청
  const connect = useCallback(async (customBaudRate?: any) => {
    try {
      setError(null);
      const nav = navigator as any;

      let targetBaud = 115200;
      if (typeof customBaudRate === 'number' && !Number.isNaN(customBaudRate) && customBaudRate > 0) {
        targetBaud = Math.floor(customBaudRate);
      } else if (typeof baudRate === 'number' && !Number.isNaN(baudRate) && baudRate > 0) {
        targetBaud = Math.floor(baudRate);
      }

      if (!nav?.serial) {
        throw new Error(
          '현재 브라우저에서는 Web Serial API(USB 시리얼 포트)를 지원하지 않습니다. PC의 Google Chrome 또는 Microsoft Edge 브라우저를 사용해주세요.'
        );
      }

      // 이전 연결이 남아있다면 안전하게 정리
      if (portRef.current || isReadingRef.current) {
        await disconnect();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 사용자에게 포트 선택 창 띄우기
      let port: any;
      try {
        port = await nav.serial.requestPort();
      } catch (err: any) {
        // 브라우저 권한 정책 (iframe 제약)
        if (
          err.name === 'SecurityError' || 
          err.message?.includes('permissions policy') || 
          err.message?.includes('disallowed') ||
          (isIframe && err.name !== 'NotFoundError')
        ) {
          throw new Error(
            '보안 정책상 현재 미리보기(iframe) 창에서는 USB 포트 접근이 차단됩니다. 상단의 [새 탭에서 열기 ↗] 버튼을 눌러 독립 브라우저 창에서 연결해주세요!'
          );
        }
        // 사용자가 포트 선택 취소한 경우
        if (err.name === 'NotFoundError') {
          setError('장치 선택이 취소되었습니다. 팝업 창에서 연결할 아두이노/ESP32 포트를 클릭한 후 [연결]을 눌러주세요.');
          return;
        }
        throw err;
      }

      if (!port) return;

      // 포트 열기 (이미 열려있는 경우 감지 및 단계별 재시도)
      if (!port.readable) {
        let opened = false;
        let lastOpenErr: any = null;

        // 최대 3회 시도 (즉시 -> 500ms 후 -> 1000ms 후)
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await port.open({ baudRate: targetBaud });
            opened = true;
            break;
          } catch (openErr: any) {
            lastOpenErr = openErr;
            const msg = openErr?.message || '';

            // 포트가 브라우저 내에서 이미 열려있는 상태인 경우 (InvalidStateError)
            if (openErr.name === 'InvalidStateError' && (msg.includes('already open') || port.readable)) {
              opened = true;
              break;
            }

            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, attempt * 500));
            }
          }
        }

        if (!opened && lastOpenErr) {
          const msg = lastOpenErr?.message || '';
          if (
            msg.includes('Failed to open') || 
            lastOpenErr.name === 'NetworkError' || 
            msg.includes('busy')
          ) {
            throw new Error(
              '선택한 USB 포트가 다른 프로그램(아두이노 IDE 시리얼 모니터 등)이나 다른 브라우저 탭에서 사용 중이어서 열 수 없습니다.\n' +
              '• 아두이노 IDE 우측 상단의 시리얼 모니터 창을 완전히 닫아주세요.\n' +
              '• 다른 브라우저 창/탭에 이 앱이 열려 있다면 닫아주세요.\n' +
              '• USB 케이블을 컴퓨터에서 뺐다가 3초 후 다시 꽂아주세요.\n' +
              '(즉시 테스트를 원하시면 [시뮬레이터 시작] 버튼으로 전체 기능을 바로 확인하실 수 있습니다)'
            );
          }
          throw lastOpenErr;
        }
      }
      
      portRef.current = port;
      setIsConnected(true);
      isReadingRef.current = true;

      // 읽기 루프 시작
      readLoopPromiseRef.current = readLoop(port);
    } catch (err: any) {
      let errMsg = err.message || '시리얼 포트 연결에 실패했습니다.';
      if (err.name === 'SecurityError' && isIframe) {
        errMsg = '보안 정책상 현재 미리보기(iframe) 창에서는 USB 포트 접근이 차단됩니다. 상단의 [새 탭에서 열기 ↗] 버튼을 눌러 독립 브라우저 창에서 연결해주세요!';
      }
      setError(errMsg);
      console.error('Serial connection error:', err);
      setIsConnected(false);
    }
  }, [baudRate, isIframe, disconnect, readLoop]);

  // 포트 강제 리셋 및 재연결
  const resetAndReconnect = useCallback(async () => {
    setError(null);
    await disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
    await connect();
  }, [disconnect, connect]);

  // USB 케이블이 물리적으로 뽑혔을 때 Web Serial API의 disconnect 이벤트 처리
  useEffect(() => {
    const nav = navigator as any;
    if (!nav?.serial) return;

    const handleDisconnect = (event: any) => {
      if (portRef.current && (event.port === portRef.current || !event.port)) {
        setError('USB 장치가 물리적으로 분리되었습니다. 케이블을 확인 후 다시 연결해주세요.');
        disconnect();
      }
    };

    nav.serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      nav.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [disconnect]);

  // 언마운트 시 안전하게 연결 해제
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { 
    isConnected, 
    connect, 
    disconnect, 
    resetAndReconnect,
    error, 
    clearError, 
    baudRate, 
    setBaudRate, 
    isIframe 
  };
}
