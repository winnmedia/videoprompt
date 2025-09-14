"use client";
import React from 'react';
import { Container } from '@/shared/ui/Container';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/utils';

export interface HeroSectionProps {
  title: string;
  subtitle?: string;
  description: string;
  primaryCta: {
    text: string;
    href?: string;
    onClick?: () => void;
    icon?: string;
  };
  secondaryCta?: {
    text: string;
    href?: string;
    onClick?: () => void;
    icon?: string;
  };
  backgroundImage?: string;
  variant?: 'default' | 'gradient' | 'video';
  className?: string;
}

export function HeroSection({
  title,
  subtitle,
  description,
  primaryCta,
  secondaryCta,
  backgroundImage,
  variant = 'default',
  className,
}: HeroSectionProps) {
  const backgroundClasses = {
    default: 'bg-gradient-to-br from-primary-50 via-white to-accent-50',
    gradient: 'bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600',
    video: 'bg-secondary-900 relative overflow-hidden',
  };

  const textClasses = {
    default: 'text-secondary-900',
    gradient: 'text-white',
    video: 'text-white relative z-10',
  };

  return (
    <section
      className={cn(
        'relative min-h-screen flex items-center py-20',
        backgroundClasses[variant],
        className
      )}
    >
      {/* 배경 이미지 또는 비디오 */}
      {variant === 'video' && backgroundImage && (
        <div className="absolute inset-0 z-0">
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src={backgroundImage} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-secondary-900/60" />
        </div>
      )}

      {variant === 'default' && backgroundImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      <Container size="lg" className="relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* 서브타이틀 */}
          {subtitle && (
            <div className="mb-6">
              <Text
                size="lg"
                weight="medium"
                className={cn(
                  variant === 'default'
                    ? 'text-primary-600'
                    : 'text-white/90'
                )}
              >
                {subtitle}
              </Text>
            </div>
          )}

          {/* 메인 제목 */}
          <div className="mb-8">
            <Heading
              level="h1"
              variant="hero"
              align="center"
              className={cn(textClasses[variant], 'mb-6')}
            >
              {title}
            </Heading>

            <Text
              size="xl"
              className={cn(
                variant === 'default'
                  ? 'text-secondary-600'
                  : 'text-white/80',
                'max-w-3xl mx-auto leading-relaxed'
              )}
            >
              {description}
            </Text>
          </div>

          {/* CTA 버튼들 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="xl"
              variant={variant === 'gradient' || variant === 'video' ? 'secondary' : 'primary'}
              onClick={primaryCta.onClick}
              className="min-w-48"
              aria-describedby="primary-cta-description"
            >
              {primaryCta.icon && (
                <Icon name={primaryCta.icon} className="w-5 h-5 mr-2" />
              )}
              {primaryCta.text}
            </Button>

            {secondaryCta && (
              <Button
                size="xl"
                variant={variant === 'gradient' || variant === 'video' ? 'outline' : 'secondary'}
                onClick={secondaryCta.onClick}
                className={cn(
                  'min-w-48',
                  (variant === 'gradient' || variant === 'video') &&
                  'border-white/30 text-white hover:bg-white/10'
                )}
                aria-describedby="secondary-cta-description"
              >
                {secondaryCta.icon && (
                  <Icon name={secondaryCta.icon} className="w-5 h-5 mr-2" />
                )}
                {secondaryCta.text}
              </Button>
            )}
          </div>

          {/* 접근성을 위한 설명 텍스트 (화면 판독기용) */}
          <div className="sr-only">
            <p id="primary-cta-description">
              {primaryCta.text} 버튼을 클릭하여 주요 기능을 시작하세요
            </p>
            {secondaryCta && (
              <p id="secondary-cta-description">
                {secondaryCta.text} 버튼을 클릭하여 추가 정보를 확인하세요
              </p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}