import {
  Zap,
  ShoppingCart,
  BarChart,
  Mail,
  Calendar,
  FileText,
  CreditCard,
  Phone,
  Video,
  Cloud,
  Globe,
  Shield,
  Camera,
  Music,
  Book,
  Briefcase,
  Coffee,
  Cpu,
  Database,
  Headphones,
  Heart,
  Image,
  Key,
  Laptop,
  Map,
  Printer,
  Rocket,
  Scissors,
  Truck,
  Wifi,
} from "lucide-react"
import type React from "react"

export type VideoPlanetIntegration = {
  id: string
  name: string
  description: string
  category: string
  icon: React.ComponentType
  color: string
  status: 'connected' | 'disconnected' | 'pending'
  apiKey?: string
  lastSync?: string
  features: string[]
}

export const integrationCategories = [
  "All",
  "AI Services",
  "Video Processing",
  "Audio Services",
  "Storage & Cloud",
  "Analytics",
  "Marketing",
  "Productivity",
  "Communication",
  "Security",
  "Design Tools",
  "Development",
  "Social Media",
  "E-commerce",
  "Customer Support",
]

const iconMap = {
  Zap,
  ShoppingCart,
  BarChart,
  Mail,
  Calendar,
  FileText,
  CreditCard,
  Phone,
  Video,
  Cloud,
  Globe,
  Shield,
  Camera,
  Music,
  Book,
  Briefcase,
  Coffee,
  Cpu,
  Database,
  Headphones,
  Heart,
  Image,
  Key,
  Laptop,
  Map,
  Printer,
  Rocket,
  Scissors,
  Truck,
  Wifi,
}

const colorPalette = [
  "#FF4A00",
  "#96BF48",
  "#E37400",
  "#FFE01B",
  "#F06A6A",
  "#FFCC22",
  "#6772E5",
  "#F22F46",
  "#2D8CFF",
  "#0061FF",
  "#00A1E0",
  "#D32D27",
  "#4CAF50",
  "#9C27B0",
  "#FF9800",
  "#795548",
  "#607D8B",
  "#3F51B5",
  "#00BCD4",
  "#FFC107",
]

// VideoPlanet 서비스에 특화된 통합 목록
export const videoPlanetIntegrations: VideoPlanetIntegration[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "AI 기반 장면 생성 및 프롬프트 최적화를 위한 OpenAI 통합. GPT-4를 활용한 고품질 영상 시나리오 생성.",
    category: "AI Services",
    icon: Zap,
    color: "#FF4A00",
    status: "connected",
    features: ["장면 생성", "프롬프트 최적화", "스토리텔링", "AI 채팅"],
    lastSync: new Date().toISOString(),
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google의 Gemini AI를 활용한 창의적인 장면 아이디어 생성 및 다국어 지원.",
    category: "AI Services",
    icon: Cpu,
    color: "#2D8CFF",
    status: "connected",
    features: ["다국어 지원", "창의적 아이디어", "이미지 분석", "AI 채팅"],
    lastSync: new Date().toISOString(),
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "실시간 데이터베이스 및 인증 시스템. 프로젝트 데이터 저장 및 사용자 관리.",
    category: "Storage & Cloud",
    icon: Database,
    color: "#4CAF50",
    status: "connected",
    features: ["실시간 DB", "인증 시스템", "파일 스토리지", "API 관리"],
    lastSync: new Date().toISOString(),
  },
  {
    id: "ffmpeg",
    name: "FFmpeg",
    description: "고성능 비디오 및 오디오 처리. 다양한 포맷 변환 및 편집 기능.",
    category: "Video Processing",
    icon: Video,
    color: "#F22F46",
    status: "pending",
    features: ["비디오 변환", "오디오 처리", "포맷 지원", "고성능 처리"],
  },
  {
    id: "aws-s3",
    name: "AWS S3",
    description: "클라우드 기반 파일 스토리지. 대용량 비디오 파일 저장 및 CDN 연동.",
    category: "Storage & Cloud",
    icon: Cloud,
    color: "#FF9800",
    status: "disconnected",
    features: ["대용량 저장", "CDN 연동", "백업 시스템", "보안 관리"],
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "사용자 행동 분석 및 성능 모니터링. 프로젝트 사용 통계 및 최적화.",
    category: "Analytics",
    icon: BarChart,
    color: "#6772E5",
    status: "pending",
    features: ["사용자 분석", "성능 모니터링", "A/B 테스트", "리포트 생성"],
  },
  {
    id: "email",
    name: "Email Service",
    description: "프로젝트 공유 및 알림을 위한 이메일 서비스. 사용자 커뮤니케이션.",
    category: "Communication",
    icon: Mail,
    color: "#00A1E0",
    status: "disconnected",
    features: ["프로젝트 공유", "알림 시스템", "템플릿 관리", "발송 추적"],
  },
  {
    id: "social",
    name: "Social Media",
    description: "소셜 미디어 플랫폼 연동. 프로젝트 홍보 및 커뮤니티 구축.",
    category: "Social Media",
    icon: Globe,
    color: "#9C27B0",
    status: "disconnected",
    features: ["컨텐츠 공유", "커뮤니티 관리", "인플루언서 연동", "트렌드 분석"],
  },
]

// 카테고리별 통합 필터링
export function getIntegrationsByCategory(category: string): VideoPlanetIntegration[] {
  if (category === "All") {
    return videoPlanetIntegrations
  }
  return videoPlanetIntegrations.filter(integration => integration.category === category)
}

// 상태별 통합 필터링
export function getIntegrationsByStatus(status: VideoPlanetIntegration['status']): VideoPlanetIntegration[] {
  return videoPlanetIntegrations.filter(integration => integration.status === status)
}

// 검색 기능
export function searchIntegrations(query: string): VideoPlanetIntegration[] {
  const lowercaseQuery = query.toLowerCase()
  return videoPlanetIntegrations.filter(integration =>
    integration.name.toLowerCase().includes(lowercaseQuery) ||
    integration.description.toLowerCase().includes(lowercaseQuery) ||
    integration.category.toLowerCase().includes(lowercaseQuery)
  )
}
