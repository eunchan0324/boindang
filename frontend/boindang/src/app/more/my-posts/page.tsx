'use client';

import { useState, useEffect } from 'react';
import MyPostCard from '@/components/myposts/MyPostCard';
import { getMyPosts, getImageListByIds } from '@/api/community';
import type { ApiPostItem } from '@/types/api/community';
import BottomNavBar from '@/components/navigation/BottomNavBar';
import Link from 'next/link';
import BackArrowIcon from '@/components/common/BackArrowIcon';

const EmptyPlaceholder = () => (
  <div className="flex flex-col items-center justify-center text-center h-full text-gray-500 pt-16">
    <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    <p>작성한 글이 없습니다.</p>
  </div>
);

export default function MyPostsPage() {
  const [myPosts, setMyPosts] = useState<ApiPostItem[]>([]);
  const [imageUrlsMap, setImageUrlsMap] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyPosts = async () => {
      setIsLoading(true);
      setError(null);
      setMyPosts([]);
      setImageUrlsMap(new Map());
      try {
        const apiResponse = await getMyPosts();
        if (apiResponse.success && apiResponse.data) {
          setMyPosts(apiResponse.data);
          const imageIdsToFetch = apiResponse.data
            .map(post => post.imageId)
            .filter((id): id is number => id !== null && id !== undefined);
          if (imageIdsToFetch.length > 0) {
            const uniqueImageIds = [...new Set(imageIdsToFetch)];
            const imageListResponse = await getImageListByIds(uniqueImageIds as number[]);
            if (imageListResponse.success && imageListResponse.data) {
              const imageList = imageListResponse.data;
              const newImageUrlsMap = new Map<number, string>();
              imageList.forEach(image => {
                newImageUrlsMap.set(image.imageId, image.imageUrl);
              });
              setImageUrlsMap(newImageUrlsMap);
            }
          }
        } else {
          setError(apiResponse.error?.message || '내가 쓴 글을 불러오는데 실패했습니다.');
        }
      } catch {
        setError('내가 쓴 글을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMyPosts();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary">
      <header className="sticky top-0 z-10 bg-white p-4 shadow-sm">
        <div className="flex items-center max-w-md mx-auto">
          <Link href="/more" className="flex items-center">
            <BackArrowIcon size={24} weight="bold" className="text-gray-700 mr-3" />
            <h1 className="text-xl font-bold text-gray-800">내가 쓴 글</h1>
          </Link>
        </div>
      </header>
      <main className="flex-grow p-4 bg-white">
        {isLoading ? (
          <div className="text-center text-gray-400 pt-16">로딩 중...</div>
        ) : error ? (
          <div className="text-center text-red-500 pt-16">{error}</div>
        ) : myPosts.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          myPosts.map(post => (
            <MyPostCard
              key={post.postId}
              postId={post.postId}
              category={post.category ?? ''}
              content={post.content}
              imageUrl={post.imageId ? imageUrlsMap.get(post.imageId) ?? undefined : undefined}
              username={post.username}
              commentCount={post.commentCount}
              likeCount={post.likeCount}
              likedByMe={post.likedByMe}
              createdAt={post.createdAt}
            />
          ))
        )}
      </main>
      <BottomNavBar />
    </div>
  );
}
