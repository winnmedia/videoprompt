"use client";
import React from 'react';
import { Container } from '@/shared/ui/Container';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/utils';

export interface CTAItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
}

export interface CTASectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  items: CTAItem[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  variant?: 'default' | 'accent' | 'minimal';
  className?: string;
}

export function CTASection({
  title,
  subtitle,
  description,
  items,
  layout = 'grid',
  variant = 'default',
  className,
}: CTASectionProps) {
  const sectionClasses = {
    default: 'bg-white',
    accent: 'bg-gradient-to-br from-primary-600 to-accent-600',
    minimal: 'bg-secondary-50',
  };

  const textClasses = {
    default: 'text-secondary-900',
    accent: 'text-white',
    minimal: 'text-secondary-900',
  };

  const layoutClasses = {
    horizontal: 'flex flex-col md:flex-row gap-6',
    vertical: 'flex flex-col gap-6',
    grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  };

  return (
    <section className={cn('py-20', sectionClasses[variant], className)}>
      <Container size="lg">
        {/* 섹션 헤더 */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          {subtitle && (
            <Text
              size="lg"
              weight="medium"
              className={cn(
                variant === 'accent'
                  ? 'text-white/90'
                  : 'text-primary-600',
                'mb-4'
              )}
            >
              {subtitle}
            </Text>
          )}

          <Heading
            level="h2"
            align="center"
            className={cn(textClasses[variant], 'mb-4')}
          >
            {title}
          </Heading>

          {description && (
            <Text
              size="lg"
              className={cn(
                variant === 'accent'
                  ? 'text-white/80'
                  : 'text-secondary-600'
              )}
            >
              {description}
            </Text>
          )}
        </div>

        {/* CTA 아이템들 */}
        <div className={layoutClasses[layout]}>
          {items.map((item) => (
            <CTACard
              key={item.id}
              item={item}
              sectionVariant={variant}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

interface CTACardProps {
  item: CTAItem;
  sectionVariant: 'default' | 'accent' | 'minimal';
}

function CTACard({ item, sectionVariant }: CTACardProps) {
  const cardClasses = {
    default: 'bg-white border border-secondary-200 hover:shadow-medium',
    accent: 'bg-white/10 border border-white/20 hover:bg-white/20',
    minimal: 'bg-white border border-secondary-200 hover:shadow-soft',
  };

  const iconClasses = {
    default: 'text-primary-600',
    accent: 'text-white',
    minimal: 'text-primary-600',
  };

  const textClasses = {
    default: 'text-secondary-900',
    accent: 'text-white',
    minimal: 'text-secondary-900',
  };

  const descriptionClasses = {
    default: 'text-secondary-600',
    accent: 'text-white/80',
    minimal: 'text-secondary-600',
  };

  const buttonVariant = item.variant || 'primary';

  return (
    <Card
      className={cn(
        'p-6 text-center transition-all duration-200 cursor-pointer hover:scale-[1.02]',
        cardClasses[sectionVariant]
      )}
      onClick={item.onClick}
      role={item.onClick ? 'button' : undefined}
      tabIndex={item.onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (item.onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          item.onClick();
        }
      }}
    >
      {/* 아이콘 */}
      {item.icon && (
        <div className="mb-4 flex justify-center">
          <div className="p-3 rounded-full bg-primary-50">
            <Icon
              name={item.icon}
              className={cn('w-8 h-8', iconClasses[sectionVariant])}
            />
          </div>
        </div>
      )}

      {/* 제목 */}
      <Heading
        level="h3"
        className={cn(textClasses[sectionVariant], 'mb-3')}
      >
        {item.title}
      </Heading>

      {/* 설명 */}
      <Text
        className={cn(descriptionClasses[sectionVariant], 'mb-6')}
      >
        {item.description}
      </Text>

      {/* 액션 버튼 */}
      <Button
        variant={
          sectionVariant === 'accent'
            ? 'secondary'
            : buttonVariant
        }
        size="lg"
        onClick={(e) => {
          e.stopPropagation();
          item.onClick?.();
        }}
        className={cn(
          sectionVariant === 'accent' &&
          buttonVariant === 'secondary' &&
          'bg-white text-primary-700 hover:bg-white/90'
        )}
        aria-label={`${item.title} 선택하기`}
      >
        시작하기
        <Icon name="arrow-right" className="w-4 h-4 ml-2" />
      </Button>
    </Card>
  );
}