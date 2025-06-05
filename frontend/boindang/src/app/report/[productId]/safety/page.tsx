"use client";

import React, { useState, useEffect, useMemo } from "react";
import ReportTabNav from "@/components/navigation/ReportTabNav";
import { Info } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from 'next/navigation';
import { getReport } from "@/api/report";
import { ApiError } from "@/types/api";
import BackArrowIcon from '@/components/common/BackArrowIcon';
// 동적 import, SSR 비활성화
const SafetyChart = dynamic(() => import("@/components/chart/SafetyChart"), {
  ssr: false,
}) as React.ComponentType<{ value: number }>;

// --- 타입 정의 시작 ---
type StatusType = 'deficiency' | 'recommend' | 'caution' | 'danger' | 'unknown';

interface NutrientDetail {
  name: string;
  value: number; 
  percent: number; 
  grade: string; 
}

interface ReportResultData {
  productName?: string;
  totalWeight?: string;
  kcal?: number;
  giGrade?: string; 
  giIndex?: number;
  nutrientRatios?: { name: string; percent: number }[];
  nutrientDetails?: NutrientDetail[];
  categorizedIngredients?: { 
    [key: string]: {
      name: string;
      description?: string[];
      gi?: number;
      shortMessage?: string;
      riskLevel?: string;
    }[]
  };
  topRisks?: { 
    name: string; 
    keyword: string; 
    title: string; 
    detail: string 
  }[];
}
// --- 타입 정의 끝 ---

// 등급별 설명 및 스타일 (기존 StatusType 키 사용)
const statusInfo: Record<StatusType, { color: string; text: string; description: string; longDescription?: string }> = {
  deficiency: {
    color: 'blue',
    text: '결핍',
    description: '1일 기준치에 비해 현저히 낮은 비율입니다.',
    longDescription: '결핍된 영양소의 보충을 위해 균형 잡힌 식단을 유지하고, 필요시 영양 보충제를 고려해볼 수 있습니다. 장기적인 결핍은 건강 문제를 일으킬 수 있으니 주의하세요.'
  },
  recommend: {
    color: 'green',
    text: '권장',
    description: '1일 기준치에 적절한 비율입니다.',
    longDescription: '적절한 영양소 섭취로 건강 유지에 도움이 됩니다. 계속해서 균형 잡힌 식단을 유지하시기 바랍니다.'
  },
  caution: {
    color: 'yellow',
    text: '주의',
    description: '1일 기준치에 비해 다소 낮거나 높아 조절이 필요할 수 있습니다.',
    longDescription: '일시적으로 문제가 되지 않을 수 있으나, 지속적인 불균형은 장기적인 건강 문제를 일으킬 수 있습니다. 특정 질환이 있는 경우 더 주의가 필요합니다.'
  },
  danger: {
    color: 'red',
    text: '위험',
    description: '1일 기준치에 비해 매우 낮거나 높아 건강에 부정적인 영향을 줄 수 있습니다.',
    longDescription: '건강에 즉각적인 영향을 줄 수 있는 수준입니다. 특히 만성 질환이 있는 경우 전문가의 상담을 받아보세요. 식단 조절이 시급히 필요합니다.'
  },
  unknown: {
    color: 'gray',
    text: '알수없음',
    description: '영양 성분 등급을 알 수 없습니다.',
    longDescription: '이 영양 성분에 대한 등급 정보가 명확하지 않습니다. 일반적인 권장 사항을 따르거나 전문가와 상담하세요.'
  }
};

// nutrientDetails의 percent를 기반으로 최종 StatusType 결정
function determineNutrientStatus(apiIndex: number): StatusType {
  if (apiIndex <= 55) {
    return 'recommend';
  } else if (apiIndex >= 56 && apiIndex <= 69) {
    return 'caution';
  } else {
    return 'danger';
  }
}

const nutrientIconMap: { [key: string]: string } = {
  '단백질': '🥩', '탄수화물': '🍚', '식이섬유': '🌾', '당류': '🍬', '지방': '🧈',
  '포화지방': '🍔', '트랜스지방': '🚫', '나트륨': '🧂', '칼륨': '🍌', '인': '🦴', '콜레스테롤': '🥚',
  // 필요시 추가
  'default': '⭐'
};

export default function SafetyPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;

  const [reportData, setReportData] = useState<ReportResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);

  useEffect(() => {
    if (productId) {
      const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            const axiosResponse = await getReport(productId);
            const apiResponse = axiosResponse.data; // ApiResponse<ReportResultData> 추출

          if (apiResponse && apiResponse.success) {
            setReportData(apiResponse.data);
          } else {
            setError(apiResponse?.error || { status: 'UNKNOWN_ERROR', message: 'API 응답 실패 또는 데이터 없음' });
            setReportData(null);
          }
        } catch (err) {
          setError(err as ApiError);
          setReportData(null);
        }
        setLoading(false);
      };
      fetchReportData();
    } else {
      setError({
        status: "BAD_REQUEST",
        message: "productId가 제공되지 않았습니다.",
      });
      setLoading(false);
    }
  }, [productId]);

  const toggleInfo = (id: string) => {
    setActiveInfo(activeInfo === id ? null : id);
  };

  const handleStatusClick = (status: StatusType) => {
    setSelectedStatus(selectedStatus === status ? null : status);
  };

  // 인라인 스타일용 색상 반환 함수
  const getStatusBorderColor = (status: StatusType) => {
    const colorMap = {
      deficiency: '#3b82f6', // blue
      recommend: '#22c55e',  // green
      caution: '#eab308',    // yellow
      danger: '#ef4444',     // red
      unknown: '#6b7280'     // gray
    };
    return colorMap[status] || colorMap.unknown;
  };

  // 텍스트 색상을 위한 인라인 스타일 함수
  const getStatusTextColor = (status: StatusType) => {
    const colorMap = {
      deficiency: '#3b82f6', // blue-500
      recommend: '#22c55e',  // green-500
      caution: '#eab308',    // yellow-500
      danger: '#ef4444',     // red-500
      unknown: '#6b7280'     // gray-500
    };
    return colorMap[status] || colorMap.unknown;
  };

  // 배경 색상을 위한 인라인 스타일 함수
  const getStatusBgColor = (status: StatusType) => {
    const colorMap = {
      deficiency: '#3b82f6', // blue-500
      recommend: '#22c55e',  // green-500
      caution: '#eab308',    // yellow-500
      danger: '#ef4444',     // red-500
      unknown: '#6b7280'     // gray-500
    };
    return colorMap[status] || colorMap.unknown;
  };

  // 연한 배경 색상을 위한 인라인 스타일 함수
  const getStatusLightBgColor = (status: StatusType) => {
    const colorMap = {
      deficiency: '#dbeafe', // blue-50
      recommend: '#dcfce7',  // green-50
      caution: '#fef9c3',    // yellow-50
      danger: '#fee2e2',     // red-50
      unknown: '#f9fafb'     // gray-50
    };
    return colorMap[status] || colorMap.unknown;
  };

  // 활성화된 배경 색상을 위한 인라인 스타일 함수
  const getStatusActiveBgColor = (status: StatusType) => {
    const colorMap = {
      deficiency: '#bfdbfe', // blue-100
      recommend: '#bbf7d0',  // green-100
      caution: '#fef08a',    // yellow-100
      danger: '#fecaca',     // red-100
      unknown: '#f3f4f6'     // gray-100
    };
    return colorMap[status] || colorMap.unknown;
  };

  const dynamicNutritionData = useMemo(() => {
    if (!reportData?.nutrientDetails) return [];
    return reportData.nutrientDetails.map(nutrient => ({
      id: nutrient.name, // 고유 ID로 사용
      name: nutrient.name,
      value: nutrient.percent, // 프로그레스 바에 사용할 값 (0-100)
      status: determineNutrientStatus(nutrient.percent),
      icon: nutrientIconMap[nutrient.name] || nutrientIconMap.default,
      description: statusInfo[determineNutrientStatus(nutrient.percent)]?.description || '',
      apiValue: nutrient.value, // 실제 g/mg 값 (필요시 사용)
      apiIndex: nutrient.percent,
    }));
  }, [reportData]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-xl font-semibold text-gray-700">리포트 로딩 중...</p></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-5">
        <p className="text-xl font-semibold text-red-500 mb-4">오류 발생</p>
        <p className="text-gray-700 mb-6 text-center">{error.message}</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">홈으로 돌아가기</button>
      </div>
    );
  }
  
  if (!reportData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-5">
        <p className="text-xl font-semibold text-gray-700 mb-4">리포트 정보를 찾을 수 없습니다.</p>
        {productId && <p className="text-sm text-gray-500 mb-6">해당 ID({productId})의 리포트가 존재하지 않거나, 데이터를 불러오는 데 문제가 발생했습니다.</p>}
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">홈으로 돌아가기</button>
      </div>
    );
  }
  
  // GI 지수 관련 텍스트 및 스타일
  const giIndex = reportData.giIndex ?? 0;
  const giStatus = determineNutrientStatus(giIndex);
  let giMessage = `이 제품의 예상 GI 지수는 ${giIndex}으로, `; 
  let giMessageColor = "text-gray-700";

  if (giStatus === 'danger') {
    giMessage += `혈당 지수를 <span class="font-bold text-red-500">위험 수준</span>으로 증가시킬 수 있어요. 각별한 주의가 필요합니다.`;
    giMessageColor = "text-red-600";
  } else if (giStatus === 'caution') {
    giMessage += `혈당 지수를 <span class="font-bold text-yellow-500">주의 수준</span>으로 증가시킬 수 있어요. 섭취량 조절이 필요할 수 있습니다.`;
    giMessageColor = "text-yellow-600";
  } else if (giStatus === 'recommend') {
    giMessage += `혈당 지수가 <span class="font-bold text-green-500">안전 수준</span>입니다. 비교적 안심하고 섭취할 수 있습니다.`;
    giMessageColor = "text-green-600";
  } else {
    giMessage += "GI 지수 등급 정보가 충분하지 않습니다.";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-10">
      <header className="flex items-center mb-2">
        <button onClick={() => router.push(`/report/${productId}`)} className="mr-2 text-2xl cursor-pointer"><BackArrowIcon/></button>
        <h1 className="text-2xl font-bold mx-auto">리포트 ({reportData.productName || "제품"})</h1>
      </header>
      <ReportTabNav productId={productId} />

      <section>
        <h2 className="font-bold text-lg mb-1">종합 혈당 지수 측정</h2>
        <p className="text-gray-400 font-light text-xs mb-3">
          식품에 포함된 성분들의 혈당 지수를 기반으로 통합 등급을 지정하였습니다.
        </p>
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className={`bg-gray-100 rounded-xl py-3 px-4 items-center mb-3 flex flex-col sm:flex-row justify-around gap-3 ${giMessageColor}`}>
            <div className={`flex flex-col items-center rounded-xl p-2 min-w-[100px]`}>
              <div className={`text-sm font-medium ${giMessageColor} opacity-80`}>예상 GI 지수</div>
              <div className="text-3xl font-bold" style={{ color: getStatusTextColor(giStatus) }}>{giIndex}</div>
            </div>
            <div className="text-sm font-light flex-1 text-center sm:text-left" dangerouslySetInnerHTML={{ __html: giMessage }} />
          </div>
          <div className="flex flex-col items-center">
            <SafetyChart value={giIndex} />
            <div className="flex justify-between w-full px-4 mt-2 text-xs">
              <span className="text-green-500 font-bold">안전 (0-55)</span>
              <span className="text-yellow-500 font-bold">주의 (56-69)</span>
              <span className="text-red-500 font-bold">위험 (70+)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-bold text-lg mb-2">영양소 등급 기준</h2>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {(['deficiency', 'recommend', 'caution', 'danger', 'unknown'] as StatusType[]).map((statusKey) => (
              <div key={statusKey} className="flex items-center justify-center">
                <button 
                  onClick={() => handleStatusClick(statusKey)}
                  className="w-full h-10 rounded-xl border font-bold text-sm sm:text-base flex items-center justify-center transition-all hover:opacity-75"
                  style={{ 
                    borderColor: getStatusBorderColor(statusKey),
                    color: getStatusTextColor(statusKey),
                    backgroundColor: selectedStatus === statusKey ? getStatusActiveBgColor(statusKey) : 'transparent'
                  }}
                >
                  {statusInfo[statusKey].text}
                </button>
              </div>
            ))}
          </div>
          
          {selectedStatus && statusInfo[selectedStatus] && (
            <div className="mt-4 pt-4 border-t">
              <div className="p-4 rounded-lg" style={{ backgroundColor: getStatusActiveBgColor(selectedStatus) }}>
                <h3 className="font-bold text-lg mb-2" style={{ color: getStatusTextColor(selectedStatus) }}>
                  {statusInfo[selectedStatus].text}
                </h3>
                <p className="text-gray-700 text-sm">{statusInfo[selectedStatus].description}</p>
                {statusInfo[selectedStatus].longDescription && 
                  <p className="mt-3 text-xs text-gray-600">{statusInfo[selectedStatus].longDescription}</p>
                }
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-2">영양 성분 등급 안내</h2>
        {dynamicNutritionData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dynamicNutritionData.map((item) => (
              <div 
              onClick={() => toggleInfo(item.id)}
                key={item.id}
                className={`bg-white cursor-pointer rounded-xl shadow p-3 border relative overflow-hidden transition-all duration-300 ${activeInfo === item.id ? 'col-span-1 sm:col-span-2' : ''}`}
                style={{ borderColor: getStatusBorderColor(item.status) }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl mr-2"
                      style={{ 
                        color: getStatusTextColor(item.status), 
                        backgroundColor: getStatusLightBgColor(item.status) 
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">
                        {item.name}
                      </div>
                      <div 
                        className="text-xs font-medium"
                        style={{ color: getStatusTextColor(item.status) }}
                      >
                        {statusInfo[item.status]?.text || '정보없음'}
                      </div>
                    </div>
                  </div>
                  <button 
                    
                    className="hover:opacity-70 transition-opacity p-1"
                    style={{ color: getStatusTextColor(item.status) }}
                  >
                    <Info size={18} weight="bold" />
                  </button>
                </div>
                
                {activeInfo === item.id && (
                  <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                    <p className="text-xs">{item.description}</p>
                    <div className="mt-2">
                      <div className="bg-gray-100 h-2.5 rounded-full mt-2 mb-1 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${item.value}%`,
                            backgroundColor: getStatusBgColor(item.status)
                          }} 
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0%</span>
                        <span 
                          className="font-medium"
                          style={{ color: getStatusTextColor(item.status) }}
                        >
                          권장량 대비 {item.value}%
                        </span>
                        <span>100%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">섭취량: {item.apiValue}{/*단위 API에 있는지 확인*/}{(item.name === '나트륨' || item.name === '콜레스테롤' || item.name === '칼륨' || item.name === '인') ? 'mg' : 'g' } (1일 기준치 대비 {item.value}%)</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">영양 성분 등급 정보가 없습니다.</p>
        )}
      </section>
    </div>
  );
}