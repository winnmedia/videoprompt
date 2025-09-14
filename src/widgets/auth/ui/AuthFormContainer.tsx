"use client";
import React from 'react';
import { Container } from '@/shared/ui/Container';
import { Card } from '@/shared/ui/card';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Logo } from '@/shared/ui/Logo';
import { cn } from '@/shared/lib/utils';

export interface AuthFormContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showLogo?: boolean;
  variant?: 'centered' | 'split';
  className?: string;
}

export function AuthFormContainer({
  title,
  subtitle,
  children,
  footer,
  showLogo = true,
  variant = 'centered',
  className,
}: AuthFormContainerProps) {
  if (variant === 'split') {
    return (
      <div className={cn('min-h-screen flex', className)}>
        {/* 좌측 브랜딩 영역 */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-accent-600 items-center justify-center p-12">
          <div className="max-w-md text-white text-center">
            {showLogo && (
              <div className="mb-8">
                <Logo variant="white" size="lg" />
              </div>
            )}
            <Heading level="h2" className="text-white mb-4">
              VideoPlanet에 오신 것을 환영합니다
            </Heading>
            <Text className="text-white/80 text-lg">
              AI 기반 영상 제작 플랫폼으로 창의적인 아이디어를 현실로 만들어보세요
            </Text>
          </div>
        </div>

        {/* 우측 폼 영역 */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <AuthFormContent
              title={title}
              subtitle={subtitle}
              showLogo={showLogo && true} // 모바일에서는 로고 표시
              logoVariant="default"
            >
              {children}
            </AuthFormContent>
            {footer}
          </div>
        </div>
      </div>
    );
  }

  // 중앙 정렬 레이아웃
  return (
    <div className={cn('min-h-screen bg-secondary-50 flex items-center justify-center p-4', className)}>
      <Container size="sm">
        <Card className="p-8 shadow-large">
          <AuthFormContent
            title={title}
            subtitle={subtitle}
            showLogo={showLogo}
            logoVariant="default"
          >
            {children}
          </AuthFormContent>
          {footer}
        </Card>
      </Container>
    </div>
  );
}

interface AuthFormContentProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showLogo: boolean;
  logoVariant: 'default' | 'white';
}

function AuthFormContent({
  title,
  subtitle,
  children,
  showLogo,
  logoVariant,
}: AuthFormContentProps) {
  return (
    <>
      {/* 헤더 */}
      <div className="text-center mb-8">
        {showLogo && (
          <div className="mb-6">
            <Logo variant={logoVariant} size="md" />
          </div>
        )}

        <Heading level="h1" align="center" className="mb-2">
          {title}
        </Heading>

        {subtitle && (
          <Text variant="muted" align="center">
            {subtitle}
          </Text>
        )}
      </div>

      {/* 폼 콘텐츠 */}
      <div className="space-y-6">
        {children}
      </div>
    </>
  );
}