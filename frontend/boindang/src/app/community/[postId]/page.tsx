'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image'; // Next.js Image 컴포넌트 임포트
import { DotsThree, Heart, ChatCircle, User } from '@phosphor-icons/react';
import { getPostDetailById, getImageListByIds, deletePost, toggleLikePost, createComment } from '../../../api/community'; // API 함수 임포트
import { ApiPostDetailData } from '../../../types/api/community';
import ConfirmModal from '../../../components/common/ConfirmModal'; // ConfirmModal 임포트
import { toast } from 'react-hot-toast';
import BackArrowIcon from '@/components/common/BackArrowIcon';

// 임시 Post 타입 및 Comment 타입, getPostById 함수는 API 연동으로 인해 제거됩니다.

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params?.postId ? parseInt(params.postId as string, 10) : null;

  const [post, setPost] = useState<ApiPostDetailData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null); // 게시글 이미지 URL 상태
  const [commentText, setCommentText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 추가된 상태 변수들
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState('');
  const [infoModalMessage, setInfoModalMessage] = useState('');
  const [infoModalOnConfirm, setInfoModalOnConfirm] = useState<(() => void) | null>(null);
  const [infoModalOnClose, setInfoModalOnClose] = useState<(() => void) | null>(null);

  useEffect(() => {
    const fetchPostDetails = async () => {
      if (postId === null) {
        setError("잘못된 게시글 ID입니다.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setPost(null);
      setImageUrl(null);

      try {
        const apiResponse = await getPostDetailById(postId);
        if (apiResponse.success && apiResponse.data) {
          const postData = apiResponse.data; // 실제 ApiPostDetailData 추출
          setPost(postData);
          if (postData.imageId) {
            const imageListResponse = await getImageListByIds([postData.imageId]);
            if (imageListResponse.success && imageListResponse.data && imageListResponse.data.length > 0) {
              const imageList = imageListResponse.data; // 실제 ApiImageListItem[] 추출
              setImageUrl(imageList[0].imageUrl);
            } else if (!imageListResponse.success) {
              // 이미지 정보 가져오기 실패 시 에러 처리
              console.warn(`Failed to fetch image for post ${postId}:`, imageListResponse.error?.message);
            }
          }
        } else {
          setError(apiResponse.error?.message || "게시글을 불러오는데 실패했습니다.");
        }
      } catch (err) {
        console.error(err);
        setError("게시글을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPostDetails();
  }, [postId]);

  const handleLikeToggle = async () => {
    if (!post || postId === null) return;

    const originalPost = { ...post }; // 롤백을 위한 원본 데이터 복사

    // 낙관적 업데이트: UI를 먼저 변경
    setPost(currentPost => {
      if (!currentPost) return null;
      return {
        ...currentPost,
        likedByMe: !currentPost.likedByMe,
        likeCount: currentPost.likedByMe ? currentPost.likeCount - 1 : currentPost.likeCount + 1,
      };
    });

    try {
      const apiResponse = await toggleLikePost(postId); // postId 사용
      if (!apiResponse.success) {
        // API 호출 실패 또는 응답 실패 시 롤백
        console.error("Failed to toggle like on server:", apiResponse.error?.message);
        setPost(originalPost); // 원래 상태로 롤백
        // 사용자에게 알림 (예: toast 메시지)
        toast.error(apiResponse.error?.message || "좋아요 처리에 실패했습니다. 다시 시도해주세요.");
      }
      // 성공 시: UI는 이미 낙관적으로 업데이트 되었으므로 별도 처리 없음
    } catch (error) {
      // 네트워크 오류 등 예외 발생 시 롤백
      console.error("Error in handleLikeToggle:", error);
      setPost(originalPost); // 원래 상태로 롤백
      toast.error("좋아요 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !post) return;
    // 댓글 등록 API 호출
    const response = await createComment(post.postId, commentText);
    if (response.success) {
      // 성공 시 댓글 목록 새로고침
      const apiResponse = await getPostDetailById(post.postId);
      if (apiResponse.success && apiResponse.data) {
        setPost(apiResponse.data);
      }
      setCommentText('');
    } else {
      alert(response.error?.message || '댓글 등록에 실패했습니다.');
    }
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleEdit = () => {
    console.log('수정하기 클릭');
    setIsMenuOpen(false);
    // TODO: 수정 페이지 이동 또는 수정 모달 표시 로직 (예: router.push(`/community/edit/${postId}`))
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (postId === null) {
      setInfoModalTitle('오류');
      setInfoModalMessage('잘못된 게시글 ID로 삭제를 시도할 수 없습니다.');
      setInfoModalOnConfirm(() => () => setShowInfoModal(false));
      setInfoModalOnClose(() => () => setShowInfoModal(false));
      setShowInfoModal(true);
      setShowDeleteModal(false);
      return;
    }
    console.log(`게시글 ${postId} 삭제 실행 시도...`);
    setIsLoading(true);
    setShowDeleteModal(false); // 먼저 삭제 확인 모달을 닫음

    try {
      const apiResponse = await deletePost(postId); // 반환 타입은 ApiResponse<null>

      if (apiResponse.success) { // isSuccess 대신 success 사용
        console.log(`게시글 ${postId} 삭제 성공`);
        toast.success('게시글이 성공적으로 삭제되었습니다.');
        router.push('/community');
      } else {
        console.error(`게시글 ${postId} 삭제 실패:`, apiResponse.error?.message); // response.message 대신 apiResponse.error.message 사용
        setInfoModalTitle('삭제 실패');
        setInfoModalMessage(apiResponse.error?.message || '게시글 삭제에 실패했습니다. 다시 시도해주세요.');
        setInfoModalOnConfirm(() => () => setShowInfoModal(false));
        setInfoModalOnClose(() => () => setShowInfoModal(false));
        setShowInfoModal(true);
      }
    } catch (err) {
      console.error(`게시글 ${postId} 삭제 중 API 오류:`, err);
      setInfoModalTitle('오류');
      setInfoModalMessage('게시글 삭제 중 오류가 발생했습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.');
      setInfoModalOnConfirm(() => () => setShowInfoModal(false));
      setInfoModalOnClose(() => () => setShowInfoModal(false));
      setShowInfoModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const retryFetchPostDetails = () => {
    if (postId !== null) {
      // useEffect의 fetchPostDetails를 직접 호출하거나,
      // postId를 변경하여 useEffect를 다시 트리거하는 방식을 고려할 수 있습니다.
      // 여기서는 상태를 초기화하고 postId를 다시 설정하여 useEffect를 재실행합니다.
      const currentPostId = postId;
      // 상태 초기화
      setPost(null);
      setImageUrl(null);
      setError(null);
      setIsLoading(true);
      // fetchPostDetails 함수를 직접 호출하기 위해 useEffect 내부 로직을 활용
      // 또는, 상태 변경으로 useEffect 재실행 유도
      // (아래는 예시이며, 실제 구현 시에는 fetchPostDetails를 useEffect 밖으로 빼는 것이 더 명확할 수 있습니다.)
      const fetchAgain = async () => {
        try {
          const apiResponse = await getPostDetailById(currentPostId);
          if (apiResponse.success && apiResponse.data) {
            const postData = apiResponse.data; // 실제 ApiPostDetailData 추출
            setPost(postData);
            if (postData.imageId) {
              const imageListResponse = await getImageListByIds([postData.imageId]);
              if (imageListResponse.success && imageListResponse.data && imageListResponse.data.length > 0) {
                const imageList = imageListResponse.data;
                setImageUrl(imageList[0].imageUrl);
              } else if (!imageListResponse.success) {
                console.warn(`Failed to fetch image for post ${currentPostId} (retry):`, imageListResponse.error?.message);
              }
            }
          } else {
            setError(apiResponse.error?.message || "게시글을 불러오는데 실패했습니다.");
          }
        } catch (err) {
          console.error(err);
          setError("게시글을 불러오는 중 오류가 발생했습니다.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchAgain();
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={retryFetchPostDetails}
          className="px-4 py-2 bg-[#6C2FF2] text-white rounded hover:bg-[#5a27cc]"
        >
          재시도
        </button>
      </div>
    );
  }

  if (!post) {
    // isLoading = false 이고 post가 여전히 null 이면 (에러 없이 데이터를 못 받은 경우)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <p className="text-gray-500 mb-4">게시글 정보를 찾을 수 없습니다.</p>
        <button
          onClick={() => router.push('/community')}
          className="px-4 py-2 bg-[#6C2FF2] text-white rounded hover:bg-[#5a27cc]"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto w-full">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b border-gray-200">
        <button onClick={() => router.back()} aria-label="뒤로 가기">
          <BackArrowIcon size={24} className="text-text-primary" />
        </button>
        {/* TODO: 현재 사용자와 게시글 작성자가 동일할 경우에만 메뉴 버튼 표시 */}
        {/* 예를 들어, post.isMine 또는 post.username === currentUser.username 등으로 확인 */}
        <div className="relative flex items-center gap-x-4">
          <button
            onClick={toggleMenu}
            aria-label="더보기"
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
          >
            <DotsThree size={24} weight="bold" className="text-text-primary" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 top-full w-32 bg-white rounded-xl border border-[#6C2FF2] shadow-lg z-20">
              <ul className="py-1">
                <li>
                  <button
                    onClick={handleEdit}
                    className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-gray-100"
                  >
                    수정하기
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleDelete}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    삭제하기
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow pb-20">
        <div className="flex items-center mb-3 px-4 pt-4">
          {/* 사용자 프로필 이미지 (임시: 첫 글자로 대체) */}
          <div className="w-10 h-10 rounded-full bg-purple-200 mr-3 flex items-center justify-center text-white font-semibold">
            {post.username?.charAt(0) || <User size={20} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{post.username}</p>
            <p className="text-xs text-text-secondary">{new Date(post.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="mb-4 px-4">
          {post.title && <h2 className="text-xl font-semibold text-text-primary mb-2">{post.title}</h2>}
          <p className="text-text-primary whitespace-pre-wrap">{post.content}</p>
          {imageUrl && (
            <div className="relative mt-4 h-[220px] bg-gray-50 rounded-lg overflow-hidden">
              <Image
                src={imageUrl}
                alt={post.title || "게시글 이미지"}
                layout="fill"
                objectFit="contain"
                className="rounded-lg"
                unoptimized
              />
            </div>
          )}
          {!imageUrl && post.imageId && (
            <div className="mt-4 h-[220px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
              이미지 로딩 중...
            </div>
          )}
        </div>

        <div className="flex items-center text-gray-600 border-y border-gray-200 py-3">
          <button
            onClick={handleLikeToggle}
            className="w-1/2 flex justify-center items-center gap-x-1 text-sm"
          >
            <Heart size={20} weight="fill" color={post.likedByMe ? '#6C2FF2' : '#A0AEC0'} />
            <span>좋아요 {post.likeCount > 0 ? post.likeCount : ''}</span>
          </button>
          <button
            onClick={() => document.getElementById('comment-input')?.focus()} // 댓글 입력창으로 포커스 이동
            className="w-1/2 flex justify-center items-center gap-x-1 text-sm"
          >
            <ChatCircle size={20} weight="fill" color="#A0AEC0" />
            <span>댓글 {post.commentCount > 0 ? post.commentCount : '달기'}</span>
          </button>
        </div>

        <div className="mt-4 space-y-4 px-4">
          {post.comments.length > 0 ? post.comments.map(comment => (
            <div key={comment.commentId} className="flex">
              {/* 댓글 작성자 프로필 이미지 (임시: 첫 글자로 대체) */}
              <div className="w-8 h-8 rounded-full bg-blue-200 mr-3 flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold">
                {comment.authorNickname?.charAt(0) || <User size={16} />}
              </div>
              <div>
                <div className='flex items-center gap-x-2'>
                  <p className="text-xs font-semibold text-text-primary">{comment.authorNickname}</p>
                  <p className="text-xs text-text-secondary">{new Date(comment.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-sm text-text-primary mt-1 whitespace-pre-wrap">{comment.content}</p>
                {/* TODO: 본인 댓글일 경우 수정/삭제 메뉴 추가 (comment.isMine 활용) */}
              </div>
            </div>
          )) : (
            <p className="text-sm text-text-secondary text-center py-4">첫 댓글을 남겨보세요!</p>
          )}
        </div>
      </main>

      {/* 댓글 입력창 (footer 역할) - 화면 맨 아래 고정 */}
      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-white border-t border-gray-200 px-4 py-3 z-50">
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-x-2">
          <ChatCircle size={24} weight="fill" color="#A0AEC0" className="flex-shrink-0" />
          <input
            id="comment-input" // 포커스 이동을 위한 ID
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 남겨주세요."
            className="flex-grow px-3 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-[#6C2FF2] focus:border-[#6C2FF2]"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className={`text-sm font-semibold px-3 py-2 rounded-full transition-colors ${commentText.trim()
                ? 'text-[#6C2FF2] hover:bg-purple-100'
                : 'text-gray-400 cursor-not-allowed'
              }`}
          >
            등록
          </button>
        </form>
      </footer>

      {/* 정보 알림 모달 (삭제 성공/실패 등) */}
      {showInfoModal && (
        <ConfirmModal
          isOpen={showInfoModal}
          onClose={() => {
            if (infoModalOnClose) infoModalOnClose();
            setShowInfoModal(false);
          }}
          onConfirm={() => {
            if (infoModalOnConfirm) infoModalOnConfirm();
            setShowInfoModal(false);
          }}
          title={infoModalTitle}
          message={infoModalMessage}
          confirmText="확인"
        // cancelText="취소" // 옵션 A: 취소 버튼도 기본값으로 표시됨
        />
      )}

      {/* 기존 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.25)] backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-text-primary mb-2 text-center">게시글을 삭제하시겠습니까?</h2>
            <p className="text-sm text-text-secondary mb-6 text-center">삭제한 글은 되돌릴 수 없습니다.</p>
            <div className="flex gap-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-text-primary font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
