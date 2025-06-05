package com.boindang.community.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.boindang.community.entity.Post;

public interface PostRepository extends JpaRepository<Post, Long> {
	// 전체 게시글 (삭제되지 않은 것만)
	Page<Post> findAllByIsDeletedFalseOrderByCreatedAtDesc(Pageable pageable);

	// 카테고리 필터 포함
	Page<Post> findAllByIsDeletedFalseAndCategoryOrderByCreatedAtDesc(String category, Pageable pageable);

	Optional<Post> findByIdAndIsDeletedFalse(Long id);

	Page<Post> findAllByUserIdAndIsDeletedFalse(Long userId, Pageable pageable);

}
