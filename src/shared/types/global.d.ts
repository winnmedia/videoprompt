/**
 * 전역 타입 정의
 * CLAUDE.md 준수: TypeScript 엄격성, 외부 라이브러리 타입 정의
 */

/**
 * Google Analytics gtag 전역 함수
 */
declare global {
  interface Window {
    gtag: typeof gtag;
    dataLayer: any[];
  }

  /**
   * Google Analytics gtag 함수 타입 정의
   */
  function gtag(
    command: 'config' | 'event' | 'js' | 'set',
    targetId: string | Date,
    config?: {
      [key: string]: any;
      page_title?: string;
      page_location?: string;
      page_path?: string;
      custom_parameter_1?: string;
      custom_parameter_2?: string;
      event_category?: string;
      event_label?: string;
      value?: number;
      currency?: string;
      transaction_id?: string;
      shipping?: number;
      tax?: number;
      items?: Array<{
        item_id?: string;
        item_name?: string;
        item_category?: string;
        item_variant?: string;
        price?: number;
        quantity?: number;
      }>;
    }
  ): void;
}

/**
 * 비용 안전 ($300 사건 방지) - gtag 이벤트 타입
 */
export interface GtagEventParams {
  /** 이벤트 카테고리 */
  event_category?: string;
  /** 이벤트 레이블 */
  event_label?: string;
  /** 이벤트 값 (숫자) */
  value?: number;
  /** 커스텀 파라미터 1 */
  custom_parameter_1?: string;
  /** 커스텀 파라미터 2 */
  custom_parameter_2?: string;
  /** 페이지 제목 */
  page_title?: string;
  /** 페이지 경로 */
  page_path?: string;
}

/**
 * Google Analytics 구성 타입
 */
export interface GtagConfig {
  /** 추적 ID */
  tracking_id: string;
  /** 페이지 제목 */
  page_title?: string;
  /** 페이지 위치 */
  page_location?: string;
  /** 페이지 경로 */
  page_path?: string;
  /** 개인정보 보호 설정 */
  anonymize_ip?: boolean;
  /** 쿠키 사용 여부 */
  allow_google_signals?: boolean;
  /** 광고 개인화 허용 여부 */
  allow_ad_personalization_signals?: boolean;
}

/**
 * 전자상거래 이벤트 아이템 타입
 */
export interface GtagEcommerceItem {
  /** 아이템 ID */
  item_id?: string;
  /** 아이템 이름 */
  item_name?: string;
  /** 아이템 카테고리 */
  item_category?: string;
  /** 아이템 변형 */
  item_variant?: string;
  /** 가격 */
  price?: number;
  /** 수량 */
  quantity?: number;
}

/**
 * 향상된 전자상거래 이벤트 파라미터
 */
export interface GtagEcommerceParams extends GtagEventParams {
  /** 통화 코드 */
  currency?: string;
  /** 거래 ID */
  transaction_id?: string;
  /** 배송비 */
  shipping?: number;
  /** 세금 */
  tax?: number;
  /** 할인 */
  discount?: number;
  /** 쿠폰 코드 */
  coupon?: string;
  /** 아이템 목록 */
  items?: GtagEcommerceItem[];
}

/**
 * 안전한 gtag 이벤트 전송 유틸리티
 * $300 사건 방지를 위한 래퍼 함수
 */
export interface SafeGtagUtils {
  /**
   * 안전한 이벤트 전송 (빈도 제한 적용)
   */
  safeEvent(eventName: string, params?: GtagEventParams): void;

  /**
   * 페이지뷰 추적 (중복 방지)
   */
  safePageView(pagePath: string, pageTitle?: string): void;

  /**
   * 사용자 정의 이벤트 (비용 제한)
   */
  safeCustomEvent(eventName: string, params?: Record<string, any>): void;
}

export {};