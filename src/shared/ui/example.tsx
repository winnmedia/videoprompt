/**
 * UI Components Usage Example
 *
 * CLAUDE.md 준수사항 검증용 예시 파일
 * 이 파일은 생성된 UI 컴포넌트들이 올바르게 작동하는지 확인하기 위한 예시입니다.
 */

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Modal,
  ModalFooter,
  Input,
  Textarea,
  Navigation,
  Grid,
  GridItem,
  Container,
  CardGrid,
} from './index';

export const UIExamples: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Navigation 예시 */}
      <Navigation
        brandText="VideoPlanet"
        onBrandClick={() => console.log('Brand clicked')}
        ctaButtons={
          <>
            <Button variant="outline" size="sm">
              시나리오 작성
            </Button>
            <Button size="sm">매뉴얼 보기</Button>
          </>
        }
      />

      <Container maxWidth="7xl">
        <div className="py-8 space-y-12">
          {/* Button 예시 */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Button Components</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button fullWidth>Full Width</Button>
              </div>
            </div>
          </section>

          {/* Input 예시 */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Input Components</h2>
            <div className="max-w-md space-y-4">
              <Input
                label="이메일"
                placeholder="이메일을 입력하세요"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Input
                label="비밀번호"
                type="password"
                status="error"
                errorMessage="비밀번호는 8자 이상이어야 합니다"
              />
              <Input
                label="성공 입력"
                status="success"
                successMessage="올바른 형식입니다"
              />
              <Textarea
                label="메시지"
                placeholder="메시지를 입력하세요"
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                autoResize
              />
            </div>
          </section>

          {/* Card 및 Grid 예시 */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Card & Grid System</h2>
            <CardGrid>
              <GridItem>
                <Card
                  title="기본 카드"
                  description="카드 설명입니다"
                  footer={
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm">
                        취소
                      </Button>
                      <Button size="sm">확인</Button>
                    </div>
                  }
                >
                  <CardContent>
                    <p className="text-neutral-600">
                      카드의 메인 컨텐츠 영역입니다.
                    </p>
                  </CardContent>
                </Card>
              </GridItem>

              <GridItem>
                <Card
                  interactive
                  onClick={() => console.log('Card clicked')}
                  shadow="md"
                >
                  <CardHeader
                    title="상호작용 카드"
                    description="클릭 가능한 카드"
                    action={
                      <Button variant="ghost" size="sm">
                        더보기
                      </Button>
                    }
                  />
                  <CardContent>
                    <p className="text-neutral-600">
                      이 카드는 클릭하거나 키보드로 접근할 수 있습니다.
                    </p>
                  </CardContent>
                </Card>
              </GridItem>

              <GridItem colSpan="full">
                <Card padding="lg">
                  <CardContent>
                    <h3 className="text-lg font-semibold mb-4">전체 너비 카드</h3>
                    <p className="text-neutral-600">
                      이 카드는 전체 너비를 차지합니다.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => setModalOpen(true)}
                    >
                      모달 열기
                    </Button>
                  </CardContent>
                </Card>
              </GridItem>
            </CardGrid>
          </section>

          {/* Grid 시스템 예시 */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Grid System</h2>
            <Grid cols={3} gap="lg">
              <GridItem>
                <div className="bg-primary-100 p-4 rounded-lg text-center">
                  Grid Item 1
                </div>
              </GridItem>
              <GridItem>
                <div className="bg-primary-100 p-4 rounded-lg text-center">
                  Grid Item 2
                </div>
              </GridItem>
              <GridItem>
                <div className="bg-primary-100 p-4 rounded-lg text-center">
                  Grid Item 3
                </div>
              </GridItem>
              <GridItem colSpan={2}>
                <div className="bg-success-100 p-4 rounded-lg text-center">
                  Span 2 Columns
                </div>
              </GridItem>
              <GridItem>
                <div className="bg-warning-100 p-4 rounded-lg text-center">
                  Single Column
                </div>
              </GridItem>
            </Grid>
          </section>
        </div>
      </Container>

      {/* Modal 예시 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="예시 모달"
        description="이것은 접근성을 고려한 모달 컴포넌트입니다."
        size="md"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            이 모달은 포커스 트랩, ESC 키 처리, 오버레이 클릭 등
            모든 접근성 기능을 지원합니다.
          </p>
          <Input
            label="모달 내 입력"
            placeholder="입력 테스트"
          />
        </div>
        <ModalFooter
          cancelActions={
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              취소
            </Button>
          }
          actions={
            <Button onClick={() => setModalOpen(false)}>
              확인
            </Button>
          }
        />
      </Modal>
    </div>
  );
};

export default UIExamples;