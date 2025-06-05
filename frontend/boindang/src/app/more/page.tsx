'use client';

import { useState, useEffect, useRef } from 'react';
import BottomNavBar from "@/components/navigation/BottomNavBar";
import { DotsThreeVertical, List, SignOut, UserMinus } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getUserInfo, getLogout, postDeleteAccount } from "@/api/auth";
import type { ApiResponse } from "@/types/api";
import type { SignUpResult } from "@/types/api/authTypes";
import { useAuthStore } from "@/stores/authStore";
import { usePreventSwipeBack } from '@/hooks/usePreventSwipeBack';
import ConfirmModal from '@/components/common/ConfirmModal';

export default function MorePage() {
    const [userInfo, setUserInfo] = useState<ApiResponse<SignUpResult> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const morePageContainerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    usePreventSwipeBack(morePageContainerRef, { edgeThreshold: 30 });

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                setLoading(true);
                const userData = await getUserInfo();
                if (userData) {
                    setUserInfo(userData);
                } else {
                    setError("사용자 정보를 불러오는데 실패했습니다.");
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "알 수 없는 에러가 발생했습니다.");
            }
            setLoading(false);
        };

        fetchUserInfo();
    }, []);

    if (loading) {
        return (
            <div ref={morePageContainerRef} className="flex flex-col mx-5 pt-15 pb-20 min-h-screen justify-center items-center">
                <p>로딩 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div ref={morePageContainerRef} className="flex flex-col mx-5 pt-15 pb-20 min-h-screen justify-center items-center">
                <p>오류: {error}</p>
            </div>
        );
    }

    if (!userInfo) {
        return (
            <div ref={morePageContainerRef} className="flex flex-col mx-5 pt-15 pb-20 min-h-screen justify-center items-center">
                <p>사용자 정보를 찾을 수 없습니다.</p>
            </div>
        );
    }

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const openLogoutModal = () => {
        setIsMenuOpen(false);
        setIsLogoutModalOpen(true);
    };

    const executeLogout = async () => {
        setIsLogoutModalOpen(false);
        try {
            const response = await getLogout();
            if (response.success && response.data) {
                useAuthStore.getState().logout();
                console.log("로그아웃 처리 완료");
                router.push('/login');
            } else {
                console.error("로그아웃 실패:", response.error?.message || "알 수 없는 오류");
                if (response.error?.status === "UNAUTHORIZED") {
                    console.log("세션 만료로 인한 자동 로그아웃 처리");
                    useAuthStore.getState().logout();
                    router.push('/login');
                } else {
                    console.error("로그아웃 처리 중 예상치 못한 오류:", response.error?.message);
                    useAuthStore.getState().logout();
                    router.push('/login');
                }
            }
        } catch (err) {
            console.error("로그아웃 API 호출 중 에러 발생:", err);
            useAuthStore.getState().logout();
            router.push('/login');
        }
    };

    const handleDeleteAccount = async () => {
        const response = await postDeleteAccount();
        if (response.success) {
            useAuthStore.getState().logout();
            console.log("회원탈퇴 처리");
            setIsMenuOpen(false);
        }
    };

    return (
        <div className="flex flex-col px-5 pt-15 pb-20 min-h-screen justify-between bg-[#F8F8F8]">
            <div className="flex flex-row justify-between items-center relative">
                <Image
                    src="/assets/more/더보기.png"
                    alt="더보기"
                    width={116}
                    height={38}
                />
                <div className="relative">
                    <button onClick={toggleMenu} className="focus:outline-none cursor-pointer hover:bg-gray-200 rounded-full">
                        <DotsThreeVertical size={24} weight="bold" fill="#363636" />
                    </button>
                    {isMenuOpen && (
                        <motion.div initial={{
                            opacity: 0,
                            scale: 0.9,
                        }}
                            animate={{
                                type: "spring",
                                opacity: 1,
                                scale: 1,
                            }}
                            transition={{
                                duration: 0.3,
                                type: "spring",
                                bounce: 0.5,
                            }}
                            className="absolute right-0 mt-2 w-30 bg-white rounded-md shadow-sm z-20">
                            <button
                                onClick={openLogoutModal}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                                <SignOut size={20} className="mr-2" />
                                로그아웃
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                                <UserMinus size={20} className="mr-2" />
                                회원탈퇴
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>

            <div className="relative my-auto text-[#363636]">
                <h2 className="text-xl font-bold">안녕하세요 {userInfo.data?.nickname}님</h2>
                <p className="text-xl font-bold mt-1">오늘도 건강하게 드셨나요?</p>
            </div>

            <div className="relative mt-auto">
                <Link href="/more/history">
                    <div className="relative mt-auto border-2 w-2/3 border-[#363636] rounded-xl py-3 px-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors">
                        <span className="text-lg font-bold text-[#363636]">나의 분석 기록</span>
                        <div className="absolute right-0 mr-7 -top-6.5">
                            <Image
                                src="/assets/more/말풍선.png"
                                alt="말풍선"
                                width={132}
                                height={40}
                            />
                            <span className="absolute flex items-center justify-center text-center w-33 h-8 inset-0 text-xs font-semibold text-[#363636]">내가 분석한 식품 더보기</span>
                        </div>
                        <List size={24} weight="bold" fill="#363636" />
                    </div>
                </Link>
            </div>

            <div className="my-5 grid grid-cols-7 grid-rows-4 gap-5 items-end cursor-pointer">
                <Link href="/more/experience" className="relative w-full h-full col-span-2 row-start-1 row-end-4">
                    <div className="bg-moreyellow h-full w-full rounded-xl relative items-end p-3 shadow-sm">
                        <span className="text-white absolute text-lg bottom-3 right-3 font-bold z-10">체험단</span>
                        <motion.div
                            initial={{
                                height: "0%",
                            }}
                            animate={{
                                height: "80%",
                            }}
                            transition={{
                                duration: 2,
                                height: {
                                    duration: 2,
                                    type: "spring",
                                    bounce: 0.5,
                                },
                            }}
                            className="absolute bottom-0 inset-x-0 bg-moreyellow-100 rounded-xl" layoutId="gradient-border" />
                    </div>
                </Link>


                <Link href="/more/quiz" className="relative w-full h-full col-span-3 row-start-1 row-span-2">
                    <div className="bg-morered h-25 mt-15 rounded-xl relative items-end p-3 shadow-sm cursor-pointer">
                        <span className="text-white absolute text-lg bottom-3 right-3 font-bold z-10">내 퀴즈</span>
                        <motion.div
                            initial={{
                                width: "0%",
                            }}
                            animate={{
                                width: "80%",
                            }}
                            transition={{
                                duration: 2,
                                width: {
                                    duration: 2,
                                    type: "spring",
                                    bounce: 0.5,
                                },
                            }}
                            className="absolute inset-y-0 right-0 bg-morered-100 rounded-xl" layoutId="gradient-border" />
                    </div>
                </Link>

                <Link href="/more/edit-profile" className="bg-moregreen h-full rounded-xl relative items-end p-3 row-start-1 row-end-3 col-end-8 col-span-2 shadow-sm cursor-pointer">
                    <span className="text-white absolute text-lg bottom-3 right-3 font-bold z-10">회원 수정</span>
                    <motion.div
                        initial={{
                            height: "0%",
                        }}
                        animate={{
                            height: "80%",
                        }}
                        transition={{
                            duration: 2,
                            height: {
                                duration: 2,
                                type: "spring",
                                bounce: 0.5,
                            },
                        }}
                        className="absolute bottom-0 inset-x-0 bg-moregreen-100 rounded-xl" layoutId="gradient-border" />
                </Link>

                <div className="relative bg-moreblue h-full w-full rounded-xl col-span-5 col-start-3 row-span-2 row-end-5 shadow-sm cursor-pointer">
                    <Link href="/more/my-posts" className="absolute inset-0">
                        <span className="text-white text-lg font-bold absolute bottom-3 right-3 z-10">내가 쓴 글</span>
                        <motion.div
                            initial={{
                                width: "0%",
                            }}
                            animate={{
                                width: "50%",
                            }}
                            transition={{
                                duration: 2,
                                width: {
                                    duration: 2,
                                    type: "spring",
                                    bounce: 0.5,
                                },
                            }}
                            className="bg-moregray absolute bottom-0 right-0 h-full w-1/2 rounded-xl flex items-end justify-end p-3" />
                    </Link>
                </div>
            </div>
            <BottomNavBar />

            <ConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={executeLogout}
                title="로그아웃"
                message="정말로 로그아웃 하시겠습니까?"
                confirmText="로그아웃"
                cancelText="취소"
            />
        </div>
    )
}