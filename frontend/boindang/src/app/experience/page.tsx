'use client';

import { useEffect, useRef, useState } from 'react';
import ExperienceHeader from '../../components/experience/ExperienceHeader';
import ExperienceList from '../../components/experience/ExperienceList';
import BottomNavBar from '../../components/navigation/BottomNavBar';
import { fetchExperiences } from '../../api/experience';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ExperienceCardProps } from '../../components/experience/ExperienceCard';
import { usePreventSwipeBack } from '@/hooks/usePreventSwipeBack';

function getRemainingDays(deadline: string, status?: string) {
  if (status === '종료') return '종료';
  const end = new Date(deadline);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return '마감';
  return `${days}일 남음`;
}

const STATUS_OPTIONS = [
  { label: '전체', value: '' },
  { label: '모집 예정', value: '모집 예정' },
  { label: '진행중', value: '진행중' },
  { label: '종료', value: '종료' },
];

const ITEMS_PER_PAGE = 5;

export default function ExperiencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const [experiences, setExperiences] = useState<ExperienceCardProps[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showFixedDropdown, setShowFixedDropdown] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  usePreventSwipeBack(pageContainerRef, { edgeThreshold: 30 });

  // 무한스크롤 데이터 로딩
  useEffect(() => {
    setExperiences([]);
    setCurrentPage(0);
    setTotalPages(1);
  }, [status]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      isFetchingRef.current = true;
      const data = await fetchExperiences(status || undefined, ITEMS_PER_PAGE, currentPage);
      if (data && data.data && Array.isArray(data.data.campaigns)) {
        const newItems = data.data.campaigns.map((item) => ({
          id: String(item.id),
          title: item.name,
          description: item.content,
          imageUrl: item.imageUrl,
          tags: item.hashtags,
          remainingDays: getRemainingDays(item.deadline, item.status),
          maxParticipants: item.capacity,
          currentParticipants: item.currentApplicants,
          openDateTime: item.startDate
            ? item.startDate.slice(5, 10).replace('-', '/') + ' ' + item.startDate.slice(11, 16)
            : '',
          applied: item.applied,
          status: item.status,
        }));
        // id 기준으로 중복 제거
        setExperiences(prev => {
          const merged = [...prev, ...newItems];
          const unique = merged.filter(
            (item, idx, arr) => arr.findIndex(i => i.id === item.id) === idx
          );
          return unique;
        });
        setTotalPages(data.data.totalPages);
      }
      setIsLoading(false);
      isFetchingRef.current = false;
    };
    fetchData();
  }, [status, currentPage]);

  // IntersectionObserver로 무한스크롤 구현
  useEffect(() => {
    if (isLoading) return;
    if (currentPage + 1 >= totalPages) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingRef.current) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 1 }
    );
    const target = observerRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [isLoading, totalPages, currentPage]);

  // 스크롤 위치에 따라 헤더/설명 숨김, 드롭다운 고정
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowFixedDropdown(scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setCurrentPage(0);
    router.push(`/experience?status=${newStatus}`);
  };

  return (
    <div ref={pageContainerRef}>
      <main className="container mx-auto px-4 py-8 pb-36">
        {/* 헤더/설명/드롭다운 묶음: 스크롤 내리면 사라짐 */}
        <div className={showFixedDropdown ? 'hidden' : ''}>
          <ExperienceHeader />
          <div className="mt-2 mb-6">
            <select
              className="border rounded px-3 py-2 text-sm"
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ minWidth: 120 }}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        {/* 드롭다운만 상단 고정 (밑줄X) */}
        {showFixedDropdown && (
          <div className="fixed top-0 left-0 w-full z-30 bg-white py-3 shadow px-4">
            <select
              className="border rounded px-3 py-2 text-sm"
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ minWidth: 120 }}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}
        {/* 드롭다운 고정 영역만큼 여백 */}
        {showFixedDropdown && <div className="h-16" />}
        <ExperienceList experiences={experiences} />
        {/* 무한스크롤 트리거 */}
        <div ref={observerRef} style={{ height: 1 }} />
        {isLoading && <div className="text-center py-6 text-gray-500">로딩 중...</div>}
      </main>
      <BottomNavBar />
    </div>
  );
} 