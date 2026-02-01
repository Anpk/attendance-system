import { ApiError } from './types';

export function toUserMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return '예상치 못한 오류가 발생했습니다.';

  switch (err.code) {
    // 인증/권한
    case 'UNAUTHORIZED':
      return '인증이 필요합니다.';
    case 'FORBIDDEN':
      return '권한이 없습니다.';

    // 계약(400/422)
    case 'MISSING_REQUIRED_PARAM':
      return '필수 입력값이 누락되었습니다. 입력값을 확인해 주세요.';
    case 'INVALID_REQUEST_PARAM':
      return '요청 값 형식이 올바르지 않습니다. 입력값을 확인해 주세요.';
    case 'INVALID_REQUEST_PAYLOAD':
      return '요청 값이 올바르지 않습니다. 다시 시도해 주세요.';

    // 정정 요청
    case 'PENDING_REQUEST_EXISTS':
      return '이미 처리 중인 정정 요청이 있습니다.';
    case 'OUT_OF_CORRECTION_WINDOW':
      return '정정 요청은 당월만 가능합니다.';
    case 'INVALID_TIME_ORDER':
      return '출근 시간이 퇴근 시간보다 늦을 수 없습니다.';
    case 'EXCEEDS_MAX_WORK_DURATION':
      return '근무 시간은 24시간을 초과할 수 없습니다.';

    // 업무 규칙(예시)
    case 'ALREADY_CHECKED_IN':
      return '이미 출근 처리되었습니다.';
    case 'NOT_CHECKED_IN':
      return '출근 기록이 없어 퇴근할 수 없습니다.';
    case 'ALREADY_CHECKED_OUT':
      return '이미 퇴근 처리되었습니다.';

    default:
      return err.message || '서버 오류가 발생했습니다.';
  }
}
