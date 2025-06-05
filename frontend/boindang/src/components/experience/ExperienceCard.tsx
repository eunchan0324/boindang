import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

function getCardStatusLabel(remainingDays: number | string, status: string, openDateTime?: string) {
  if (status === '모집 예정' && openDateTime) {
    // openDateTime: '05/10 00:00' 형태로 들어옴
    const [monthDay, time] = openDateTime.split(' ');
    const [month, day] = monthDay.split('/');
    return `${month}월 ${day}일 ${time} 오픈`;
  }
  if (status === '진행중') {
    return '모집중';
  }
  // 마감/종료면 아무것도 표시하지 않음
  return '';
}

interface ExperienceCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  tags: string[];
  remainingDays: number | string;
  maxParticipants?: number;
  currentParticipants?: number;
  openDateTime?: string;
  applied: boolean;
  status?: string;
}

export type { ExperienceCardProps };
export default function ExperienceCard({
  id,
  title,
  description,
  imageUrl,
  tags,
  remainingDays,
  maxParticipants = 0,
  currentParticipants = 0,
  openDateTime = '',
  applied,
  status = '',
}: ExperienceCardProps) {
  const statusLabel = getCardStatusLabel(remainingDays, status, openDateTime);
  return (
    <Link href={`/experience/${id}`}>
      <motion.div 
        className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4"
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        {/* 이미지 */}
        <div className="relative w-full h-[200px]">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            unoptimized
          />
          {statusLabel && (
            <div
              className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs text-white ${status === '진행중' ? 'bg-[#6C2FF2]' : 'bg-black/60'}`}
            >
              {statusLabel}
            </div>
          )}
          {typeof remainingDays === 'string' && remainingDays === '종료' && !applied && (
            <>
              <div className="absolute inset-0 bg-black/40 z-10 rounded-t-2xl pointer-events-none" />
              <Image
                src="/assets/experience/sugar_fail.png"
                alt="모집 마감"
                width={200}
                height={200}
                className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none scale-140"
                style={{ background: 'rgba(0,0,0,0.0)' }}
                unoptimized
              />
            </>
          )}
          {applied && (
            <Image
              src="/assets/experience/sugar_success.png"
              alt="신청 성공"
              width={200}
              height={200}
              className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none scale-100"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              unoptimized
            />
          )}
        </div>

        {/* 컨텐츠 */}
        <div className="p-4">
          {/* 제품 정보 */}
          <div className="mb-3">
            {maxParticipants > 0 && (
              <div className="mb-2">
                <span className="text-[#6C2FF2] font-semibold text-sm">
                  선착순 {maxParticipants}명
                </span>
                <span className="text-gray-400 text-xs ml-2">
                  ({currentParticipants}명 신청완료)
                </span>
              </div>
            )}
            <h3 className="font-medium text-base mb-1">{title}</h3>
            <p className="text-gray-600 text-sm line-clamp-2">
              {description}
            </p>
          </div>

          {/* 해시태그 */}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, index) => (
              <span 
                key={index}
                className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </Link>
  );
} 