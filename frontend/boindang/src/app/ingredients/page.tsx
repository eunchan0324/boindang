'use client';

import React, { useState, useEffect, useRef } from 'react';
import BottomNavBar from '@/components/navigation/BottomNavBar';
import Link from 'next/link';
import { MagnifyingGlass, WarningCircle, CheckCircle, Fire } from '@phosphor-icons/react';
import CategoryListSection from './components/CategoryListSection';
import type { PopularIngredient } from '@/types/api/encyclopedia';
import { fetchPopularIngredients } from '@/api/encyclopedia';
import FeaturedIngredientsCarousel from './components/FeaturedIngredientsSection';
import { usePreventSwipeBack } from '@/hooks/usePreventSwipeBack';

const categoryIngredients = [
  { name: '단백질', imageSrc: '/assets/category_icon/danback.png' },
  { name: '당류', imageSrc: '/assets/category_icon/dang.png' },
  { name: '감미료', imageSrc: '/assets/category_icon/gammi.png' },
  { name: '식이섬유', imageSrc: '/assets/category_icon/sike.png' },
  { name: '지방', imageSrc: '/assets/category_icon/jibang.png' },
  { name: '식품첨가물', imageSrc: '/assets/category_icon/chumga.png' },
  { name: '비타민', imageSrc: '/assets/category_icon/vita.png' },
  { name: '미네랄', imageSrc: '/assets/category_icon/mine.png' },
];

// 새로운 섹션을 위한 데이터 정의
const surprisingBadIngredients = [
  {
    id: 'erythritol',
    name: '에리스리톨',
    description: "섭취 시 복통 및 설사 유발 가능성이 있고, 최근 연구에서 심혈관 질환 위험과의 연관성이 제기되었어요.",
    tag: '소화불량주의',
    imageSrc: '/assets/ingre/erythritol-3.jpg' // 예시 이미지 경로
  },
  {
    id: 'maltodextrin',
    name: '말토덱스트린',
    description: "혈당을 빠르게 올려 당뇨 환자나 혈당 관리가 필요한 경우 주의해야 하는 성분이에요.",
    tag: '혈당스파이크',
    imageSrc: '/assets/ingre/maltodextrin.jpg' // 예시 이미지 경로
  },
  {
    id: 'hfcs',
    name: '액상과당 (HFCS)',
    description: "과다 섭취 시 비만, 지방간, 대사증후군 등의 위험을 높일 수 있어 주의가 필요해요.",
    tag: '대사질환위험',
    imageSrc: '/assets/ingre/acsang.jpg' // 예시 이미지 경로
  },
];

const surprisingGoodIngredients = [
  {
    id: 'vitamin_d',
    name: '비타민 D',
    description: "칼슘 흡수를 돕고 뼈 건강 유지 및 면역 기능에 중요한 역할을 해요.",
    tag: '뼈튼튼면역UP',
    imageSrc: '/assets/ingre/vitamind.jpg' // 예시 이미지 경로
  },
  {
    id: 'omega3',
    name: '오메가-3 지방산',
    description: "혈행 개선, 두뇌 건강, 염증 감소에 도움을 줄 수 있는 착한 지방이에요.",
    tag: '혈관튼튼',
    imageSrc: '/assets/ingre/omega3.jpg' // 예시 이미지 경로
  },
  {
    id: 'probiotics',
    name: '프로바이오틱스',
    description: "장내 유익균을 늘려 장 건강과 면역력 강화에 도움을 줄 수 있어요.",
    tag: '장건강UP',
    imageSrc: '/assets/ingre/proby.jpg' // 예시 이미지 경로
  },
];

export default function IngredientsPage() {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  usePreventSwipeBack(mainContainerRef, { edgeThreshold: 30 });

  const [popularIngredients, setPopularIngredients] = useState<PopularIngredient[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState<boolean>(true);
  const [errorPopular, setErrorPopular] = useState<string | null>(null);

  useEffect(() => {
    const fetchPopular = async () => {
      setIsLoadingPopular(true);
      setErrorPopular(null);
      try {
        const response = await fetchPopularIngredients(3);

        if (response.success && response.data) {
          setPopularIngredients(response.data);
        } else {
          setErrorPopular(response.error?.message || '인기 검색어 정보를 가져오는데 실패했습니다.');
          setPopularIngredients([]);
        }
      } catch (err) {
        if (err instanceof Error) {
          setErrorPopular(err.message);
        } else {
          setErrorPopular('알 수 없는 오류가 발생했습니다.');
        }
        setPopularIngredients([]);
      }
      setIsLoadingPopular(false);
    };

    fetchPopular();
  }, []);

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto shadow-sm pb-[70px]">
        <div className="bg-white p-4">
          <h1 className="text-xl font-bold mb-4">영양 성분 백과</h1>
          <Link href="/ingredients/search" className="block mb-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlass size={20} className="text-gray-400" />
              </div>
              <div
                className="w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 pl-10 pr-4 py-2 text-gray-500 cursor-pointer"
              >
                어떤 성분이 궁금하세요?
              </div>
            </div>
          </Link>
        </div>

        <>
          <hr className="border-gray-200" />
          <div className="bg-gray-50 p-4">
            {/* 실시간 영양 성분 Top 3 */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <Fire size={24} className="mr-2 text-orange-500" />
                실시간 영양 성분 Top 3
              </h2>
              <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
                {isLoadingPopular ? (
                  <p className="p-3 text-center text-gray-500">Top 3 로딩 중...</p>
                ) : errorPopular ? (
                  <p className="p-3 text-center text-red-500">오류: {errorPopular}</p>
                ) : popularIngredients.length > 0 ? (
                  popularIngredients.map((item, index) => (
                    <div
                      key={item.ingredientName}
                      className={`flex items-center justify-between p-3 ${index < popularIngredients.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full">
                          {index + 1}
                        </span>
                        <Link
                          href={`/ingredients/detail/${encodeURIComponent(item.ingredientId)}`}
                          className="text-gray-800 hover:underline"
                        >
                          {item.ingredientName}
                        </Link>
                      </div>
                      <span className="text-gray-600 font-medium">{item.count}회</span>
                    </div>
                  ))
                ) : (
                  <p className="p-3 text-center text-gray-500">인기 검색어 정보가 없습니다.</p>
                )}
              </div>
            </section>

            {/* 카테고리별 성분 사전 */}
            <CategoryListSection categoryIngredients={categoryIngredients} />

            {/* 주목! 이런 성분은 처음이죠? */}
            <div className="mt-8">
              <FeaturedIngredientsCarousel
                title={
                  <span className="flex items-center">
                    <WarningCircle size={24} className="mr-2 text-red-500" />
                    {"잠깐! 이 성분, 괜찮을까요?"}
                  </span>
                }
                ingredients={surprisingBadIngredients}
                theme="bad"
              />
              <FeaturedIngredientsCarousel
                title={
                  <span className="flex items-center">
                    <CheckCircle size={24} className="mr-2 text-green-500" />
                    {"꼭 챙겨야 할 착한 성분!"}
                  </span>
                }
                ingredients={surprisingGoodIngredients}
                theme="good"
              />
            </div>
          </div>
        </>
      </div>

      {/* Fixed Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
        <BottomNavBar />
      </div>
    </div>
  );
}