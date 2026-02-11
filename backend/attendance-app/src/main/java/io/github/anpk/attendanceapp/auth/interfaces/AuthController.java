package io.github.anpk.attendanceapp.auth.interfaces;

import io.github.anpk.attendanceapp.auth.jwt.JwtTokenService;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final EmployeeRepository employeeRepository;
    private final JwtTokenService jwtTokenService;

    public AuthController(EmployeeRepository employeeRepository, JwtTokenService jwtTokenService) {
        this.employeeRepository = employeeRepository;
        this.jwtTokenService = jwtTokenService;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody(required = false) LoginRequest body) {
        if (body == null || body.userId() == null || body.password() == null || body.password().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "userId/password는 필수입니다.");
        }

        var e = employeeRepository.findById(body.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "인증 정보가 올바르지 않습니다."));

        if (!e.isActive()) {
            throw new BusinessException(ErrorCode.EMPLOYEE_INACTIVE, "비활성 사용자입니다.");
        }

        if (!body.password().equals(e.getPassword())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "인증 정보가 올바르지 않습니다.");
        }

        String token = jwtTokenService.issueToken(e.getUserId(), e.getRole());
        return new LoginResponse(token, "Bearer", jwtTokenService.getExpiresSeconds());
    }

    public record LoginRequest(Long userId, String password) {}
    public record LoginResponse(String accessToken, String tokenType, long expiresIn) {}
}