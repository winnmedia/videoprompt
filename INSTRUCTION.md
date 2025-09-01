최종 개발 요구사항 명세서 (Final)
Part 1: UI 드롭다운 메뉴 선택 옵션 상세 정의
개발에 필요한 각 드롭다운 메뉴의 선택 옵션을 아래와 같이 정의합니다.

1.1. Base_Style (기본 스타일) 선택 옵션

영상미 (Visual Style): Photorealistic, Hyperrealistic, Cinematic, Anamorphic, Vintage Film

장르 (Genre): Action-Thriller, Sci-Fi Noir, Fantasy Epic, Modern Drama, Horror

분위기 (Mood): Tense, Moody, Gritty, Serene, Energetic, Nostalgic

화질 (Quality): 4K, 8K, IMAX Quality, HD

연출 스타일 (Director Style - Optional): Christopher Nolan style, David Fincher style, Wes Anderson style

1.2. Spatial_Context (공간적 배경) 선택 옵션

날씨 (Weather): Clear, Rain, Heavy Rain, Snow, Fog, Overcast

조명 (Lighting): Daylight (Midday), Golden Hour, Blue Hour, Night, Studio Lighting, Flickering Light

1.3. Camera_Setting (카메라 설정) 선택 옵션

기본 렌즈 (Primary Lens): 16mm Fisheye, 24mm Wide-angle, 50mm Standard, 85mm Portrait, 135mm Telephoto

주요 움직임 (Dominant Movement): Static Shot, Shaky Handheld, Smooth Tracking (Dolly), Crane Shot, Zoom

1.4. Core_Object (핵심 사물) 선택 옵션

재질 (Material): Brushed Metal, Polished Wood, Transparent Glass, Matte Plastic, Rough Fabric, Leather

1.5. Timeline (타임라인) 선택 옵션

카메라 앵글 (Angle): Wide Shot (WS), Medium Shot (MS), Close Up (CU), Extreme Close Up (ECU), Point of View (POV)

카메라 무빙 (Move): Pan (Left/Right), Tilt (Up/Down), Dolly (In/Out), Tracking (Follow), Whip Pan

템포 (Pacing): Real-time, Slow-motion (0.5x), Slow-motion (0.2x), Fast-motion (2x), Time-lapse, Freeze-frame

음향 품질 (Audio Quality): Clear, Muffled, Echoing, Distant, Crisp

Part 2: 통합 기능 명세 (복사/붙여넣기 최적화 형식)
Phase 1: 프로젝트 설정 및 메타데이터

1. Prompt_Name (프롬프트 이름)

사용자 인터랙션: 텍스트 필드에 프로젝트 이름 입력.

프론트엔드 구현: MetadataForm.jsx 컴포넌트 내 promptName state를 관리.

백엔드 연동: 없음 (클라이언트).

데이터 모델: metadata.prompt_name

2. Base_Style (기본 스타일)

사용자 인터랙션: '스타일 태그 빌더'에서 각 카테고리별 드롭다운 메뉴(Part 1.1 참조)를 통해 태그 선택.

프론트엔드 구현: MetadataForm.jsx에서 styleTags[] state를 배열로 관리.

백엔드 연동: 없음 (클라이언트).

데이터 모델: metadata.base_style (배열을 쉼표로 구분된 문자열로 저장)

(이하 Phase 1의 Spatial_Context, Camera_Setting 등 모든 요소가 위와 같은 형식으로 클라이언트 state와 데이터 모델에 매핑됩니다.)

Phase 2: 장면 요소 정의

1. Characters (등장인물) 및 이미지 업로드

사용자 인터랙션: +캐릭터 추가 버튼 클릭 후 팝업창에 설명 입력. [🖼️ 이미지 업로드] 버튼을 눌러 레퍼런스 이미지 파일 선택.

프론트엔드 구현: ElementBuilder.jsx가 ImageUploader.jsx 컴포넌트를 호출. 이미지 업로드 성공 시 반환된 URL을 characters[] state 객체 배열의 해당 캐릭터에 저장.

백엔드 연동: POST /api/upload/image. 이미지 파일(multipart/form-data)을 전송하고 { "imageUrl": "..." } 응답을 받음.

데이터 모델: elements.characters[i].reference_image_url

(이하 Phase 2의 Core_Object 등 모든 요소가 위와 같은 형식으로 매핑됩니다.)

Phase 3: 타임라인 연출

1. DynamicTimeline (동적 타임라인)

사용자 인터랙션: [+ 타임스탬프 추가] 버튼을 눌러 TS-3, TS-4 블록 생성. 각 블록의 '연출 패널'에서 드롭다운(Part 1.5 참조)과 텍스트 필드로 세부 연출 내용 입력.

프론트엔드 구현: DynamicTimeline.jsx 컴포넌트가 segments[] state(객체 배열)를 관리. 사용자의 모든 입력은 이 배열 내의 해당 객체 속성으로 실시간 업데이트됨.

백엔드 연동: 없음 (클라이언트).

데이터 모델: timeline 배열 및 그 안의 모든 객체.

Phase 4: 최종화 및 생성

1. LLM Assistant (지능형 어시스턴트)

사용자 인터랙션: [✨ LLM 자동 추천] 버튼 클릭.

프론트엔드 구현: LLMAssistant.jsx가 현재까지의 모든 프롬프트 state를 취합하여 하나의 JSON 객체로 만듦. 이 객체를 Axios를 통해 백엔드에 전송.

백엔드 연동: POST /api/generate/suggestions. 요청 Body에 전체 프롬프트 데이터를 담아 전송하고, { "keywords": [...], "negatives": [...] } 형식의 응답을 받음.

데이터 모델: 응답 받은 데이터를 tuning.keywords와 tuning.negative_prompts 필드에 업데이트.

2. Generate Prompt Code (최종 코드 생성)

사용자 인터랙션: [GENERATE PROMPT CODE] 버튼 클릭.

프론트엔드 구현: 최상위 컴포넌트가 모든 state를 종합하여 최종 JSON 객체를 생성. 생성된 객체를 텍스트 형태로 변환하여 화면에 표시하고 '클립보드 복사' 기능 활성화.

백엔드 연동: 없음 (클라이언트).

데이터 모델: 최종 완성된 JSON 객체 전체.
