'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import BackArrowIcon from '../../../components/common/BackArrowIcon';
import { fetchExperienceDetail, applyExperience } from '../../../api/experience';
import { useAuthStore } from '../../../stores/authStore';
import type { ExperienceDetail } from '../../../types/api/experience';
import AlertModal from '../../../components/common/AlertModal';

function getTimeDiff(target: string) {
  const now = new Date();
  const end = new Date(target);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 60) % 60);
  const seconds = Math.floor(diff % 60);
  return { days, hours, minutes, seconds };
}

function getRemainingDays(deadline: string, status?: string) {
  if (status === '종료') return '종료';
  const end = new Date(deadline);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return '마감';
  return `${days}일 남음`;
}

export default function ExperienceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = Number(params.id);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [experience, setExperience] = useState<ExperienceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const handleApply = async () => {
    if (!accessToken || !campaignId) return;
    setApplying(true);
    try {
      const res = await applyExperience(campaignId);
      if (res.success) {
        setModalTitle('신청 완료');
        setModalMessage('신청이 완료되었습니다.');
      } else {
        setModalTitle('신청 실패');
        setModalMessage(res.error?.message || '신청에 실패했습니다.');
      }
      setModalOpen(true);
    } catch {
      setModalTitle('신청 실패');
      setModalMessage('신청에 실패했습니다.');
      setModalOpen(true);
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (!accessToken || !campaignId) return;
    setLoading(true);
    fetchExperienceDetail(campaignId)
      .then((res) => {
        setExperience(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('상세 정보를 불러오지 못했습니다.');
        setLoading(false);
      });
  }, [accessToken, campaignId]);

  useEffect(() => {
    if (!experience || experience.status !== '모집 예정') return;
    setCountdown(getTimeDiff(experience.startDate));
    const timer = setInterval(() => {
      setCountdown(getTimeDiff(experience.startDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [experience]);

  if (loading) return <div>로딩 중...</div>;
  if (error || !experience) return <div>{error || '데이터 없음'}</div>;

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-screen-sm mx-auto relative">
      {/* 상품 이미지 + 상단 뒤로가기 버튼 */}
      <div className="relative w-full h-[400px]">
        <button
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          className="absolute top-4 left-4 z-20 bg-white rounded-full p-2 shadow-md"
        >
          <BackArrowIcon size={24} className="text-text-primary" />
        </button>
        <Image
          src={experience.imageUrl}
          alt={experience.name}
          fill
          className="object-contain bg-white"
          unoptimized
        />
      </div>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-5 py-6">
          <div className="text-sm text-gray-500 mb-2">{experience.mainCategory} &gt; {experience.subCategory}</div>
          <h1 className="text-xl font-semibold mb-2">{experience.name}</h1>
          <p className="text-gray-600 mb-4">{experience.content}</p>

          {/* 태그 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {experience.hashtags.map((tag, index) => (
              <span key={index} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                #{tag}
              </span>
            ))}
          </div>

          {/* 체험단 정보 */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-[#6C2FF2] font-semibold">
                선착순 {experience.capacity}명
              </span>
              <span className="text-gray-400 text-sm">
                ({experience.applicantCount}명 신청완료)
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {experience.startDate.slice(5, 10).replace('-', '/')} {experience.startDate.slice(11, 16)} 오픈 예정
            </div>
          </div>

          {/* 안내사항 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h2 className="font-semibold mb-3">꼭 확인해주세요!</h2>
            <ul className="space-y-2">
              {experience.notices.map((notice, index) => (
                <li key={index} className="text-sm text-gray-600">• {notice}</li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      {/* 하단 고정 버튼 */}
      <div className="sticky bottom-0 left-0 right-0 w-full">
        {experience.status === '모집 예정' && countdown ? (
          <button
            className="w-full bg-gray-300 text-white py-3 rounded-none text-sm font-medium border-t"
            disabled
          >
            {`${countdown.days}일 ${countdown.hours}시간 ${countdown.minutes}분 ${countdown.seconds}초 후 신청`}
          </button>
        ) : experience.applied ? (
          <button
            className="w-full bg-gray-300 text-white py-3 rounded-none text-sm font-medium border-t"
            disabled
          >
            신청완료
          </button>
        ) : experience.status === '종료' || getRemainingDays(experience.deadline, experience.status) === '마감' ? (
          <button
            className="w-full bg-gray-300 text-white py-3 rounded-none text-sm font-medium border-t"
            disabled
          >
            모집 마감
          </button>
        ) : (
          <button
            className="w-full bg-[#6C2FF2] text-white py-3 rounded-none text-sm font-medium border-t"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? '신청 중...' : '신청하기'}
          </button>
        )}
      </div>
      <AlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        message={modalMessage}
      />
    </div>
  );
} 
