package com.boindanguser.user.service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.boindanguser.common.model.dto.ApiResponses;
import com.boindanguser.user.model.dto.JwtTokenDto;
import com.boindanguser.user.model.dto.request.UpdateUserRequest;
import com.boindanguser.user.model.dto.request.UserLoginRequest;
import com.boindanguser.user.model.dto.request.UserSignupRequest;
import com.boindanguser.user.model.dto.response.UserResponse;
import com.boindanguser.user.model.entity.User;
import com.boindanguser.user.model.type.UserType;
import com.boindanguser.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

	private final UserRepository userRepository;
	private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
	private final RestClient restClient;
	private final EurekaService eurekaService;

	public UserResponse signup(UserSignupRequest request) {
		if (userRepository.existsByUsername(request.getUsername())) {
			throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
		}

		User user = User.builder()
			.username(request.getUsername())
			.password(passwordEncoder.encode(request.getPassword()))
			.nickname(request.getNickname())
			.userType(UserType.valueOf(request.getUserType()))
			.gender(request.getGender())
			.height(request.getHeight())
			.weight(request.getWeight())
			.build();

		User saved = userRepository.save(user);
		return UserResponse.from(saved);
	}

	public JwtTokenDto login(UserLoginRequest request) {
		User user = userRepository.findByUsername(request.getUsername())
			.orElseThrow(() -> new IllegalArgumentException("해당 사용자를 찾을 수 없습니다."));

		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
		}

		try {
			String url = eurekaService.getUrl("AUTH") + "auth/createToken/" + user.getId();
			System.out.println("url: " + url);
			ApiResponses<JwtTokenDto> response = restClient.get()
				.uri(url)
				.retrieve()
				.body(new ParameterizedTypeReference<ApiResponses<JwtTokenDto>>() {
				});
			if (!response.isSuccess()) {
				System.out.println("TODO: 로그인 중 문제 발생");
				//TODO
			}
			return response.getData();
		} catch (Exception e) {
			throw new RuntimeException("Access Token 생성 중 오류 발생: " + e.getMessage(), e);
		}
	}

	public String refresh(Long userId) {
		try {
			String url = eurekaService.getUrl("AUTH") + "auth/refresh/" + userId;
			long startTime = System.currentTimeMillis();
			ApiResponses<String> response = restClient.get()
				.uri(url)
				.retrieve()
				.body(new ParameterizedTypeReference<ApiResponses<String>>() {
				});
			System.out.println("내부호출 소요시간: " + (System.currentTimeMillis() - startTime) + "ms");
			if (!response.isSuccess()) {
				System.out.println("TODO: refresh 중 문제 발생");
				//TODO
			}
			return response.getData();
		} catch (Exception e) {
			throw new RuntimeException("Access Token 생성 중 오류 발생: " + e.getMessage(), e);
		}
	}

	public Boolean logout(String token) {
		try {
			String url = eurekaService.getUrl("AUTH") + "auth/invalidate";
			ApiResponses<Boolean> response = restClient.post()
				.uri(url)
				.body(Map.of("token", token))
				.retrieve()
				.body(new ParameterizedTypeReference<ApiResponses<Boolean>>() {
				});
			if (!response.isSuccess()) {
				System.out.println("TODO: 로그아웃 중 문제 발생");
				//TODO
			}
			return response.getData();
		} catch (Exception e) {
			throw new RuntimeException("토큰 파기 중 오류 발생: " + e.getMessage(), e);
		}
	}

	public void deleteUserById(Long userId) {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
		userRepository.delete(user);
	}

	public UserResponse getUserInfo(Long userId) {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
		return UserResponse.from(user);
	}

	public void changeNickname(Long userId, String newNickname) {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));

		user.setNickname(newNickname);
		userRepository.save(user);
	}

	public UserResponse updateUser(Long userId, UpdateUserRequest request) {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

		if (request.getGender() != null) {
			user.setGender(request.getGender());
		}
		if (request.getHeight() != null) {
			user.setHeight(request.getHeight());
		}
		if (request.getWeight() != null) {
			user.setWeight(request.getWeight());
		}
		if (request.getUserType() != null) {
			user.setUserType(UserType.valueOf(request.getUserType()));
		}
		if (request.getNickname() != null) {
			user.setNickname(request.getNickname());
		}

		userRepository.save(user);
		return UserResponse.from(user);
	}

	public boolean isUsernameTaken(String username) {
		return userRepository.existsByUsername(username);
	}

	public Map<Long, String> getUsernamesByIds(List<Long> userIds) {
		List<User> users = userRepository.findAllById(userIds);
		return users.stream()
			.collect(Collectors.toMap(User::getId, User::getNickname));
	}
}
