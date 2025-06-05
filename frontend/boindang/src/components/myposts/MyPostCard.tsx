import Link from 'next/link';
import Image from 'next/image';
import { Heart, ChatCircle } from '@phosphor-icons/react';

export interface MyPostCardProps {
  postId: number;
  category: string;
  content: string;
  imageUrl?: string | null;
  username: string;
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export default function MyPostCard({
  postId,
  category,
  content,
  imageUrl,
  username,
  commentCount,
  likeCount,
  likedByMe,
  createdAt,
}: MyPostCardProps) {
  return (
    <Link href={`/community/${postId}`} className="block bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors duration-150 rounded-xl mb-4">
      <div className="flex items-center mb-3">
        <div className="w-8 h-8 rounded-full bg-purple-200 mr-2 flex items-center justify-center text-xs text-white">
          {username?.charAt(0) || 'U'}
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{username}</p>
          <p className="text-xs text-text-secondary">{new Date(createdAt).toLocaleString()}</p>
        </div>
        <span className="ml-auto px-2 py-0.5 bg-gray-100 text-xs text-gray-500 rounded-full">{category}</span>
      </div>
      <p className={`text-text-primary text-sm ${imageUrl ? 'mb-2' : 'mb-4'} line-clamp-3`}>{content}</p>
      {imageUrl ? (
        <div className="relative h-[180px] bg-gray-50 rounded-[22px] mb-4 overflow-hidden">
          <Image
            src={imageUrl}
            alt={"게시글 이미지"}
            layout="fill"
            objectFit="contain"
            className="rounded-[22px]"
            unoptimized
          />
        </div>
      ) : null}
      <div className="flex items-center text-gray-600 mt-2">
        <div className="w-1/2 flex justify-center items-center gap-x-1">
          <Heart size={22} weight="fill" color={likedByMe ? '#6C2FF2' : '#A0AEC0'} />
          <span className="text-sm">{likeCount}</span>
        </div>
        <div className="w-1/2 flex justify-center items-center gap-x-1">
          <ChatCircle size={22} weight="fill" color="#A0AEC0" />
          <span className="text-sm">{commentCount > 0 ? `${commentCount}개 댓글` : '댓글 달기'}</span>
        </div>
      </div>
    </Link>
  );
} 