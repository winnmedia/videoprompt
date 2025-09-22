/**
 * Grid System Components
 *
 * CLAUDE.md 준수사항:
 * - 반응형 그리드 (데스크탑 2열, 모바일 1열)
 * - 200ms 이하 애니메이션
 * - 임의값 사용 금지
 * - data-testid 네이밍 규약
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps } from 'react';

// Grid Container variants
const gridVariants = cva(
  ['grid gap-6 w-full'],
  {
    variants: {
      // 열 개수 variant
      cols: {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        responsive: 'grid-cols-responsive',
      },
      // 간격 variant
      gap: {
        none: 'gap-0',
        sm: 'gap-4',
        md: 'gap-6',
        lg: 'gap-8',
        xl: 'gap-12',
      },
      // 정렬 variant
      align: {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
        stretch: 'items-stretch',
      },
      // 수직 정렬
      justify: {
        start: 'justify-items-start',
        center: 'justify-items-center',
        end: 'justify-items-end',
        stretch: 'justify-items-stretch',
      },
    },
    defaultVariants: {
      cols: 2,
      gap: 'md',
      align: 'stretch',
      justify: 'stretch',
    },
  }
);

// Grid Item variants
const gridItemVariants = cva(
  ['transition-all duration-150 ease-out'],
  {
    variants: {
      // 열 스팬
      colSpan: {
        1: 'col-span-1',
        2: 'col-span-1 md:col-span-2',
        3: 'col-span-1 md:col-span-2 lg:col-span-3',
        4: 'col-span-1 md:col-span-2 lg:col-span-4',
        full: 'col-span-full',
      },
      // 행 스팬
      rowSpan: {
        1: 'row-span-1',
        2: 'row-span-2',
        3: 'row-span-3',
        4: 'row-span-4',
        full: 'row-span-full',
      },
    },
    defaultVariants: {
      colSpan: 1,
      rowSpan: 1,
    },
  }
);

// Container variants
const containerVariants = cva(
  ['mx-auto px-4 sm:px-6 lg:px-8'],
  {
    variants: {
      maxWidth: {
        sm: 'max-w-screen-sm',
        md: 'max-w-screen-md',
        lg: 'max-w-screen-lg',
        xl: 'max-w-screen-xl',
        '2xl': 'max-w-screen-2xl',
        '7xl': 'max-w-7xl',
        full: 'max-w-none',
      },
    },
    defaultVariants: {
      maxWidth: '7xl',
    },
  }
);

// Grid Props 타입 정의
export interface GridProps
  extends ComponentProps<'div'>,
    VariantProps<typeof gridVariants> {
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

/**
 * Grid 컨테이너 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 2열 그리드 (모바일에서 1열)
 * <Grid>
 *   <GridItem>항목 1</GridItem>
 *   <GridItem>항목 2</GridItem>
 * </Grid>
 *
 * // 3열 그리드
 * <Grid cols={3}>
 *   <GridItem>항목 1</GridItem>
 *   <GridItem>항목 2</GridItem>
 *   <GridItem>항목 3</GridItem>
 * </Grid>
 *
 * // 반응형 자동 그리드
 * <Grid cols="responsive">
 *   <GridItem>항목 1</GridItem>
 *   <GridItem>항목 2</GridItem>
 * </Grid>
 * ```
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      className,
      cols,
      gap,
      align,
      justify,
      children,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={gridVariants({ cols, gap, align, justify, className })}
        data-testid={dataTestId || 'ui-grid'}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';

// Grid Item Props 타입 정의
export interface GridItemProps
  extends ComponentProps<'div'>,
    VariantProps<typeof gridItemVariants> {
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

/**
 * Grid 아이템 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 그리드 아이템
 * <GridItem>내용</GridItem>
 *
 * // 2열 스팬
 * <GridItem colSpan={2}>넓은 아이템</GridItem>
 *
 * // 전체 열 스팬
 * <GridItem colSpan="full">전체 너비 아이템</GridItem>
 * ```
 */
export const GridItem = React.forwardRef<HTMLDivElement, GridItemProps>(
  (
    {
      className,
      colSpan,
      rowSpan,
      children,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={gridItemVariants({ colSpan, rowSpan, className })}
        data-testid={dataTestId || 'ui-grid-item'}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GridItem.displayName = 'GridItem';

// Container Props 타입 정의
export interface ContainerProps
  extends ComponentProps<'div'>,
    VariantProps<typeof containerVariants> {
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

/**
 * Container 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 컨테이너 (max-w-7xl)
 * <Container>
 *   <Grid>
 *     <GridItem>내용</GridItem>
 *   </Grid>
 * </Container>
 *
 * // 큰 컨테이너
 * <Container maxWidth="2xl">
 *   내용
 * </Container>
 * ```
 */
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      className,
      maxWidth,
      children,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={containerVariants({ maxWidth, className })}
        data-testid={dataTestId || 'ui-container'}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

// 사전 정의된 레이아웃 컴포넌트들

/**
 * 카드 그리드 레이아웃 (데스크탑 2열, 모바일 1열)
 */
export interface CardGridProps extends Omit<GridProps, 'cols'> {
  /** 카드 간격 */
  spacing?: 'sm' | 'md' | 'lg';
}

export const CardGrid = React.forwardRef<HTMLDivElement, CardGridProps>(
  ({ spacing = 'md', gap, ...props }, ref) => {
    return (
      <Grid
        ref={ref}
        cols={2}
        gap={gap || spacing}
        data-testid="ui-card-grid"
        {...props}
      />
    );
  }
);

CardGrid.displayName = 'CardGrid';

/**
 * 대시보드 그리드 레이아웃 (반응형 3열)
 */
export interface DashboardGridProps extends Omit<GridProps, 'cols'> {}

export const DashboardGrid = React.forwardRef<HTMLDivElement, DashboardGridProps>(
  (props, ref) => {
    return (
      <Grid
        ref={ref}
        cols={3}
        gap="lg"
        data-testid="ui-dashboard-grid"
        {...props}
      />
    );
  }
);

DashboardGrid.displayName = 'DashboardGrid';

/**
 * 리스트 그리드 레이아웃 (단일 열)
 */
export interface ListGridProps extends Omit<GridProps, 'cols'> {}

export const ListGrid = React.forwardRef<HTMLDivElement, ListGridProps>(
  (props, ref) => {
    return (
      <Grid
        ref={ref}
        cols={1}
        gap="sm"
        data-testid="ui-list-grid"
        {...props}
      />
    );
  }
);

ListGrid.displayName = 'ListGrid';