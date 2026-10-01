import React, { useState, useEffect } from 'react';
import { HeartHandshake, Star, Plus, Trash2, Check, BookmarkPlus, Sparkles } from 'lucide-react';
import { CalmingMethod, ParentCalmingItem } from '../types';
import { 
  loadParentCalmingItems, 
  addParentCalmingItem, 
  deleteParentCalmingItem 
} from '../utils/fourteenDayStorage';

export default function CalmingView() {
  const methods: CalmingMethod[] = [
    { id: '1', action: '안아주기 (Deep Pressure)', count: 12, avgTimeSeconds: 180, effectiveness: 92, rank: 1 },
    { id: '2', action: '조용한 음악 재생', count: 8, avgTimeSeconds: 320, effectiveness: 75, rank: 2 },
    { id: '3', action: '좋아하는 장난감 (Spinning)', count: 15, avgTimeSeconds: 240, effectiveness: 68, rank: 3 },
    { id: '4', action: '심호흡 유도 (같이 숨쉬기)', count: 5, avgTimeSeconds: 450, effectiveness: 45, rank: 4 },
    { id: '5', action: '산책하기', count: 2, avgTimeSeconds: 600, effectiveness: 30, rank: 5 },
  ];

  // 부모 등록 진정 요소 상태
  const [parentItems, setParentItems] = useState<ParentCalmingItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState<'sensory' | 'object' | 'sound' | 'action' | 'other'>('sensory');
  const [title, setTitle] = useState('');
  const [effectiveness, setEffectiveness] = useState<'high' | 'medium' | 'moderate'>('high');
  const [tip, setTip] = useState('');

  useEffect(() => {
    setParentItems(loadParentCalmingItems());
  }, []);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const categoryLabels: Record<string, string> = {
      sensory: '감각/압박',
      object: '애착 물건',
      sound: '소리/음악',
      action: '환경/행동',
      other: '기타 직접입력'
    };

    const updated = addParentCalmingItem({
      category,
      categoryLabel: categoryLabels[category] || '기타',
      title: title.trim(),
      effectivenessRating: effectiveness,
      tip: tip.trim() || undefined
    });

    setParentItems(updated);
    setTitle('');
    setTip('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('이 진정 요소를 삭제하시겠습니까?')) {
      const updated = deleteParentCalmingItem(id);
      setParentItems(updated);
    }
  };

  const handleQuickPreset = (presetTitle: string, presetCat: 'sensory' | 'object' | 'sound' | 'action' | 'other', presetTip: string) => {
    setIsAdding(true);
    setCategory(presetCat);
    setTitle(presetTitle);
    setTip(presetTip);
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50/50 space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">진정 방법 분석</h2>
        <p className="text-gray-500 mt-1">과부하 상태에서 효과적이었던 대처 방법 및 부모 직접 등록 진정 요법</p>
      </header>

      {/* AI 추천 진정 방법 순위 */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-white">
          <HeartHandshake className="text-emerald-500" size={24} />
          <h3 className="text-lg font-bold text-gray-800">AI 추천 진정 방법 순위</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="py-4 px-6 font-semibold text-gray-500 text-sm">순위</th>
                <th className="py-4 px-6 font-semibold text-gray-500 text-sm">행동</th>
                <th className="py-4 px-6 font-semibold text-gray-500 text-sm">시도 횟수</th>
                <th className="py-4 px-6 font-semibold text-gray-500 text-sm">평균 진정 소요 시간</th>
                <th className="py-4 px-6 font-semibold text-gray-500 text-sm">효과(%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {methods.map((method) => (
                <tr key={method.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1 font-black text-gray-900">
                      {method.rank === 1 && <Star size={16} className="text-yellow-400 fill-yellow-400" />}
                      #{method.rank}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-bold text-gray-800">{method.action}</td>
                  <td className="py-4 px-6 font-medium text-gray-600">{method.count}회</td>
                  <td className="py-4 px-6 font-medium text-gray-600">
                    {Math.floor(method.avgTimeSeconds / 60)}분 {method.avgTimeSeconds % 60}초
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700 w-12">{method.effectiveness}%</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-24">
                        <div 
                          className={`h-full rounded-full ${method.effectiveness > 80 ? 'bg-emerald-500' : method.effectiveness > 60 ? 'bg-blue-500' : 'bg-orange-400'}`}
                          style={{ width: `${method.effectiveness}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 부모 직접 등록 아이 진정 방법 섹션 */}
      <div className="bg-gradient-to-br from-amber-50/60 via-white to-purple-50/40 p-6 md:p-8 rounded-3xl border border-amber-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1">
                <Sparkles size={12} className="text-amber-600" />
                보호자 커스텀 기록
              </span>
              <span className="text-xs text-gray-500 font-medium">
                등록된 진정 요소 {parentItems.length}개
              </span>
            </div>
            <h3 className="text-xl font-black text-gray-900">
              우리 아이가 진정되는 방법 직접 등록
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              AI가 추천한 가이드 외에도, 부모님이 직접 아이가 어떤 것에 진정되는지(애착 물건, 가중 담요, 특정 노래, 안아주기, 기타 등) 자유롭게 입력해두면 항상 저장되어 조회할 수 있습니다.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(prev => !prev)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow transition-all shrink-0"
          >
            <Plus size={15} />
            {isAdding ? '닫기' : '진정 방법 직접 추가'}
          </button>
        </div>

        {/* 퀵 프리셋 버튼 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            추천 요소 원클릭 추가:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickPreset('가중 담요 덮어주기 및 깊은 포옹', 'sensory', '불을 끄고 가중 담요로 어깨와 등을 감싸주면 3분 이내로 안정')}
              className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              + 가중 담요 / 깊은 압박
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('좋아하는 동요/잔잔한 음악 재생', 'sound', '헤드폰으로 낮은 볼륨의 빗소리나 좋아하는 동요 들려주기')}
              className="px-3 py-1.5 bg-white hover:bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              + 잔잔한 음악 / 백색소음
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('애착 인형 / 촉감 스퀴시 주기', 'object', '손에 쥐고 주무를 수 있는 말랑이를 주면 손 떨림이 잦아듬')}
              className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              + 애착 인형 / 스퀴시
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('조명 낮추고 조용한 공간으로 유도', 'action', '시각 자극을 줄여주면 흥분이 빠르게 가라앉음')}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              + 조용한 방 / 조명 끄기
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(true);
                setCategory('other');
                setTitle('');
                setTip('');
              }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
            >
              + 기타 직접 입력
            </button>
          </div>
        </div>

        {/* 등록 폼 */}
        {isAdding && (
          <form onSubmit={handleAddItem} className="bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-md space-y-4">
            <div className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <BookmarkPlus size={16} className="text-amber-500" />
              새로운 아이 맞춤 진정 방법 입력
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  분류 카테고리
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'sensory', label: '감각/압박' },
                    { id: 'object', label: '애착 물건' },
                    { id: 'sound', label: '소리/음악' },
                    { id: 'action', label: '환경/행동' },
                    { id: 'other', label: '기타' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold text-center transition-all ${
                        category === cat.id
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  진정 효과 정도
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEffectiveness('high')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      effectiveness === 'high'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    매우 효과적 (★★★)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEffectiveness('medium')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      effectiveness === 'medium'
                        ? 'bg-blue-500 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    효과적 (★★)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEffectiveness('moderate')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      effectiveness === 'moderate'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    상황별 (★)
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                진정 방법 및 행동 명칭 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 공룡 인형을 품에 안겨주고 조용히 기다려주기 / 등을 천천히 두드려주기"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                보호자 노하우 / 주의사항 메모 (선택)
              </label>
              <input
                type="text"
                value={tip}
                onChange={e => setTip(e.target.value)}
                placeholder="예: 아이에게 말을 걸지 않고 차분히 옆에 머물러 줄 때 가장 효과가 좋음"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
              >
                <Check size={14} />
                저장하기
              </button>
            </div>
          </form>
        )}

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {parentItems.map(item => {
            const stars = item.effectivenessRating === 'high' ? '★★★' : item.effectivenessRating === 'medium' ? '★★☆' : '★☆☆';
            const badgeBg = 
              item.category === 'sensory' ? 'bg-purple-100 text-purple-800 border-purple-200' :
              item.category === 'sound' ? 'bg-rose-100 text-rose-800 border-rose-200' :
              item.category === 'object' ? 'bg-blue-100 text-blue-800 border-blue-200' :
              item.category === 'action' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
              'bg-gray-100 text-gray-800 border-gray-200';

            return (
              <div 
                key={item.id} 
                className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${badgeBg}`}>
                      {item.categoryLabel || '진정 요법'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 text-xs font-black tracking-widest" title={`효과: ${stars}`}>
                        {stars}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-300 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-gray-900 leading-snug mb-2">
                    {item.title}
                  </h4>
                </div>

                {item.tip && (
                  <div className="mt-2 bg-amber-50/70 p-2.5 rounded-xl border border-amber-100/70 text-[11px] text-amber-900 leading-relaxed font-medium">
                    <strong className="text-amber-800 block text-[10px] uppercase font-bold">부모 팁:</strong>
                    {item.tip}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {parentItems.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-300 text-center space-y-2">
            <HeartHandshake className="mx-auto text-gray-400" size={32} />
            <div className="font-bold text-sm text-gray-700">아직 등록된 부모 진정 방법이 없습니다.</div>
            <p className="text-xs text-gray-500">
              상단의 추천 요소 버튼을 누르거나 아이가 편안해하는 요소를 직접 등록해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
