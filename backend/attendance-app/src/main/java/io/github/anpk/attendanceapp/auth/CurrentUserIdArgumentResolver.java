package io.github.anpk.attendanceapp.auth;

import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

public class CurrentUserIdArgumentResolver implements HandlerMethodArgumentResolver {

    private static final String HEADER = "X-USER-ID";

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUserId.class)
                && (Long.class.equals(parameter.getParameterType()) || long.class.equals(parameter.getParameterType()));
    }

    @Override
    public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
    ) {
        // ✅ JWT 필터가 주입한 userId가 있으면 우선 사용
        Object attr = webRequest.getAttribute(
                io.github.anpk.attendanceapp.auth.jwt.JwtAuthFilter.REQ_ATTR_USER_ID,
                NativeWebRequest.SCOPE_REQUEST
        );
        if (attr instanceof Long) {
            return attr;
        }
        if (attr instanceof Integer) {
            return ((Integer) attr).longValue();
        }

        String raw = webRequest.getHeader(HEADER);

        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "인증이 필요합니다.");
        }

        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "인증 정보가 올바르지 않습니다.");
        }
    }
}
