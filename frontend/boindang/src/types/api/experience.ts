export interface ExperienceApiError {
  status: string;
  message: string;
}

export interface Experience {
    id: number;
    name: string;
    content: string;
    imageUrl: string;
    startDate: string;
    deadline: string;
    status: string;
    capacity: number;
    currentApplicants: number;
    hashtags: string[];
    applied: boolean;
  }
  
  export interface ExperienceListResponse {
    data: {
      totalPages: number;
        campaigns: Experience[];
    };
    error: ExperienceApiError | null;
    success: boolean;
  }

export interface ExperienceDetail {
  id: number;
  name: string;
  content: string;
  mainCategory: string;
  subCategory: string;
  imageUrl: string;
  startDate: string;
  deadline: string;
  status: string;
  capacity: number;
  applicantCount: number;
  hashtags: string[];
  notices: string[];
  applied: boolean;
}