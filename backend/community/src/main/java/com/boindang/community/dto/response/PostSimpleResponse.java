package com.boindang.community.dto.response;

import java.time.LocalDateTime;

import com.boindang.community.entity.Post;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PostSimpleResponse {
	private Long postId;
	private String category;
	private String content;
	private Long imageId;

	private String username;

	private int commentCount;
	private int likeCount;
	private boolean likedByMe;

	private LocalDateTime createdAt;

	public static PostSimpleResponse from(Post post, String username, boolean likedByMe) {
		return PostSimpleResponse.builder()
			.postId(post.getId())
			.category(post.getCategory())
			.content(post.getContent())
			.imageId(post.getImageId())
			.username(username)
			.commentCount(post.getCommentCount())
			.likeCount(post.getLikeCount())
			.likedByMe(likedByMe)
			.createdAt(post.getCreatedAt())
			.build();
	}
}

