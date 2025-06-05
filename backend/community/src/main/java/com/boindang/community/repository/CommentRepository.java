package com.boindang.community.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.boindang.community.entity.Comment;
import com.boindang.community.entity.Like;

public interface CommentRepository extends JpaRepository<Comment, Long> {
	List<Comment> findByPostIdAndIsDeletedFalseOrderByCreatedAtAsc(Long postId);

}