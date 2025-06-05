package com.boindang.community.controller;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.boindang.community.dto.request.CreateCommentRequest;
import com.boindang.community.dto.response.ApiResponses;
import com.boindang.community.dto.response.CommentResponse;
import com.boindang.community.service.CommentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("")
@RequiredArgsConstructor
@Tag(name = "댓글", description = "커뮤니티 댓글 관련 API입니다.")
public class CommentController {

	private final CommentService commentService;

	@Operation(summary = "댓글 작성", description = "게시글에 댓글을 작성합니다.")
	@PostMapping("/{postId}/comments")
	public ApiResponses<CommentResponse> createComment(
		@PathVariable Long postId,
		@RequestBody @Valid CreateCommentRequest request,
		@RequestHeader("X-User-Id") String userId
	) {
		return ApiResponses.success(commentService.createComment(postId, Long.parseLong(userId), request));
	}
}
