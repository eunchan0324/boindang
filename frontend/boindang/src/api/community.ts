import { ApiPostListData, ApiImageIdListRequest, ApiImageListItem, ApiPostDetailData, ApiCreatePostRequest, ApiCreatePostResponseData } from '@/types/api/community';
import apiClient from '../lib/apiClient';
import { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api';
import type { ApiPostItem } from '@/types/api/community';

interface GetCommunityPostsParams {
  category?: string;
  page?: number; // 페이지네이션을 위한 주석 처리된 예시
  size?: number; // 페이지네이션을 위한 주석 처리된 예시
}

/**
 * 커뮤니티 게시글 목록을 조회하는 API 함수
 * apiClient를 사용하여 요청하며, 인증 토큰은 apiClient의 인터셉터에서 처리합니다.
 * @param params 선택적 파라미터 객체 (category, page, size 등 포함 가능)
 * @returns Promise<ApiResponse<ApiPostListData>> - 성공 또는 실패 정보를 담은 ApiResponse 객체
 */
export const getCommunityPosts = async (params?: GetCommunityPostsParams): Promise<ApiResponse<ApiPostListData>> => {
  try {
    const response = await apiClient.get<ApiResponse<ApiPostListData>>('/community/read', { params });

    // apiClient의 응답 인터셉터가 이미 ApiResponse<T> 형태로 데이터를 변환해준다고 가정합니다.
    // 따라서 response.data는 이미 ApiResponse<ApiPostListData> 형태일 것입니다.
    return response.data;

  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>; // 서버 에러 응답 구조에 맞게 조정
    console.error('Error fetching community posts:', axiosError.response?.data?.message || axiosError.message || error);
    // ApiResponse<T> 형식에 맞춰 에러 객체 반환
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || '커뮤니티 게시글을 불러오는데 실패했습니다.',
      },
      success: false,
    };
  }
};

/**
 * 이미지 ID 목록을 사용하여 이미지 정보 목록(URL 포함)을 조회하는 API 함수
 * @param imageIds - 조회할 이미지 ID의 배열
 * @returns Promise<ApiResponse<ApiImageListItem[]>> - 성공 또는 실패 정보를 담은 ApiResponse 객체
 */
export const getImageListByIds = async (imageIds: ApiImageIdListRequest): Promise<ApiResponse<ApiImageListItem[]>> => {
  if (!imageIds || imageIds.length === 0) {
    // 빈 배열 요청 시 성공적으로 빈 데이터를 반환하는 것으로 처리
    return {
      data: [],
      error: null,
      success: true,
    };
  }

  try {
    const response = await apiClient.post<ApiResponse<ApiImageListItem[]>>('/image/imageList', imageIds);
    // apiClient 응답 인터셉터가 ApiResponse<T> 형태로 변환해준다고 가정
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>;
    console.error('Error fetching image list from /image/imageList:', axiosError.response?.data?.message || axiosError.message || error);
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || '이미지 목록을 불러오는데 실패했습니다.',
      },
      success: false,
    };
  }
};

// 게시글 상세 정보를 조회하는 API 함수
export const getPostDetailById = async (postId: number): Promise<ApiResponse<ApiPostDetailData>> => {
  if (isNaN(postId) || postId <= 0) {
    console.error('Invalid postId:', postId);
    return {
      data: null,
      error: { status: 'CLIENT_ERROR', message: '유효하지 않은 게시글 ID입니다.' },
      success: false,
    };
  }
  try {
    const response = await apiClient.get<ApiResponse<ApiPostDetailData>>(`/community/${postId}`);
    // apiClient의 응답 인터셉터가 ApiResponse<T> 형태로 데이터를 변환해준다고 가정
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>;
    console.error(`Error fetching post detail for postId ${postId}:`, axiosError.response?.data?.message || axiosError.message || error);
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || `게시글(${postId}) 상세 정보를 불러오는데 실패했습니다.`,
      },
      success: false,
    };
  }
};

export const createCommunityPost = async (postData: ApiCreatePostRequest): Promise<ApiResponse<ApiCreatePostResponseData>> => {
  try {
    const response = await apiClient.post<ApiResponse<ApiCreatePostResponseData>>('/community/write', postData);
    // apiClient 응답 인터셉터가 ApiResponse<T> 형태로 변환해준다고 가정
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>;
    console.error('Error creating community post:', axiosError.response?.data?.message || axiosError.message || error);
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || '게시글 작성에 실패했습니다.',
      },
      success: false,
    };
  }
};

/**
 * 게시글 삭제 API
 * @param postId 삭제할 게시글 ID
 * @returns Promise<ApiResponse<null>>
 */
export const deletePost = async (postId: number): Promise<ApiResponse<null>> => {
  try {
    const response = await apiClient.delete<ApiResponse<null>>(`/community/${postId}`);
    // apiClient 응답 인터셉터가 ApiResponse<T> 형태로 변환해준다고 가정
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>;
    console.error(`Error deleting post ${postId}:`, axiosError.response?.data?.message || axiosError.message || error);
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || `게시글(${postId}) 삭제에 실패했습니다.`,
      },
      success: false,
    };
  }
};

/**
 * 게시글 좋아요/취소 API 함수
 * @param postId 좋아요 토글할 게시글 ID
 * @returns Promise<ApiResponse<null>> - 성공 또는 실패 정보를 담은 ApiResponse 객체
 */
export const toggleLikePost = async (postId: number): Promise<ApiResponse<null>> => {
  if (isNaN(postId) || postId <= 0) {
    console.error('Invalid postId for like toggle:', postId);
    return {
      data: null,
      error: { status: 'CLIENT_ERROR', message: '유효하지 않은 게시글 ID입니다.' },
      success: false,
    };
  }
  try {
    // 요청 본문 없이 POST 요청
    const response = await apiClient.post<ApiResponse<null>>(`/community/${postId}/likes`);
    // apiClient 응답 인터셉터가 ApiResponse<T> 형태로 변환해준다고 가정
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>;
    console.error(`Error toggling like for postId ${postId}:`, axiosError.response?.data?.message || axiosError.message || error);
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || `게시글(${postId}) 좋아요 처리에 실패했습니다.`,
      },
      success: false,
    };
  }
};

/**
 * 게시글에 댓글 작성 API
 * @param postId 댓글을 작성할 게시글 ID
 * @param content 댓글 내용
 * @returns Promise<ApiResponse<null>>
 */
export const createComment = async (
  postId: number,
  content: string
): Promise<ApiResponse<null>> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>(
      `/community/${postId}/comments`,
      { content }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ status?: string; message?: string }>;
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || '댓글 작성에 실패했습니다.',
      },
      success: false,
    };
  }
};

/**
 * 내가 쓴 글 목록 조회 API
 * @returns Promise<ApiResponse<ApiPostItem[]>>
 */
export const getMyPosts = async (): Promise<ApiResponse<ApiPostItem[]>> => {
  try {
    const response = await apiClient.get<ApiResponse<ApiPostItem[]>>('/community/my/posts');
    return response.data;
  } catch (error) {
    const axiosError = error as import('axios').AxiosError<{ status?: string; message?: string }>;
    return {
      data: null,
      error: {
        status: axiosError.response?.data?.status || 'CLIENT_ERROR',
        message: axiosError.response?.data?.message || '내가 쓴 글을 불러오는데 실패했습니다.',
      },
      success: false,
    };
  }
};
