package com.boindang.community.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.boindang.community.client.UserClient;
import com.boindang.community.common.exception.NotFoundException;
import com.boindang.community.dto.request.CreateCommentRequest;
import com.boindang.community.dto.response.CommentResponse;
import com.boindang.community.entity.Comment;
import com.boindang.community.entity.Post;
import com.boindang.community.repository.CommentRepository;
import com.boindang.community.repository.PostRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CommentService {

	private final PostRepository postRepository;
	private final CommentRepository commentRepository;
	private final UserClient userClient;

	@Transactional
	public CommentResponse createComment(Long postId, Long userId, CreateCommentRequest request) {
		Post post = postRepository.findByIdAndIsDeletedFalse(postId)
			.orElseThrow(() -> new NotFoundException("존재하지 않는 게시글입니다."));

		Comment comment = Comment.builder()
			.postId(post.getId())
			.userId(userId)
			.content(request.getContent())
			.isDeleted(false)
			.createdAt(LocalDateTime.now())
			.build();

		commentRepository.save(comment);

		post.increaseCommentCount(); // ✅ 이 한 줄 추가
		postRepository.save(post);

		String nickname = userClient.getUsernameById(userId);

		return CommentResponse.from(comment, userId, nickname);
	}

}
