{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cinegenius.app/schemas/cinegenius-v3.1.veo-optimized.json",
  "title": "CineGenius v3.1 Canonical Model (Veo 3 Optimized)",
  "description": "CineGenius 프로젝트 데이터 모델 v3.1. Veo 3 최적화 컴파일러 로직 지원을 위해 보강된 버전.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "projectId",
    "createdAt",
    "userInput",
    "projectConfig",
    "promptBlueprint",
    "generationControl",
    "finalOutput"
  ],
  "properties": {
    "version": { "type": "string", "const": "3.1" },
    "projectId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F-]{36}$",
      "description": "UUID v4 형식 문자열"
    },
    "createdAt": { "type": "string", "format": "date-time" },

    "userInput": {
      "type": "object",
      "additionalProperties": false,
      "required": ["oneLineScenario"],
      "properties": {
        "oneLineScenario": { "type": "string", "minLength": 1, "maxLength": 500 },
        "targetAudience": { "type": "string", "minLength": 0, "maxLength": 200 },
        "referenceUrls": {
          "type": "array",
          "items": { "type": "string", "format": "uri" },
          "maxItems": 20,
          "uniqueItems": true
        },
        "referenceAudioUrl": { "type": "string", "format": "uri" }
      }
    },

    "projectConfig": {
      "type": "object",
      "additionalProperties": false,
      "required": ["creationMode", "frameworkType", "aiAssistantPersona"],
      "properties": {
        "creationMode": { "type": "string", "minLength": 1 },
        "frameworkType": { "type": "string", "minLength": 1 },
        "aiAssistantPersona": { "type": "string", "minLength": 1 }
      }
    },

    "promptBlueprint": {
      "type": "object",
      "additionalProperties": false,
      "required": ["metadata", "elements", "timeline"],
      "properties": {
        "metadata": {
          "type": "object",
          "description": "전역 설정. 영상 전체의 기본 스타일 및 환경 정의. timeline의 개별 설정에 의해 오버라이드될 수 있음.",
          "additionalProperties": false,
          "required": ["promptName", "baseStyle", "spatialContext", "cameraSetting", "deliverySpec"],
          "properties": {
            "promptName": { "type": "string", "minLength": 1, "maxLength": 120 },

            "baseStyle": {
              "type": "object",
              "description": "시각적 미학 정의. 컴파일 시 [스타일/미학] 섹션의 기반이 됨 (Priority 3).",
              "additionalProperties": false,
              "required": ["visualStyle", "genre", "mood", "quality", "styleFusion"],
              "properties": {
                "visualStyle": { "type": "string", "minLength": 1, "maxLength": 80 },
                "genre": { "type": "string", "minLength": 1, "maxLength": 80 },
                "mood": { "type": "string", "minLength": 1, "maxLength": 80 },
                "quality": { "type": "string", "minLength": 1, "maxLength": 40 },
                "styleFusion": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["styleA", "styleB", "ratio"],
                  "properties": {
                    "styleA": { "type": "string", "minLength": 1, "maxLength": 80 },
                    "styleB": { "type": "string", "minLength": 1, "maxLength": 80 },
                    "ratio": { "type": "number", "minimum": 0, "maximum": 1 }
                  }
                }
              }
            },

            "spatialContext": {
              "type": "object",
              "description": "장면 및 환경 정의. 컴파일 시 [장면/환경] 섹션의 기반이 됨 (Priority 2).",
              "additionalProperties": false,
              "required": ["placeDescription", "weather", "lighting"],
              "properties": {
                "placeDescription": { "type": "string", "minLength": 1, "maxLength": 300 },
                "weather": { "type": "string", "minLength": 1, "maxLength": 40 },
                "lighting": { "type": "string", "minLength": 1, "maxLength": 60, "description": "조명 설정 (예: Golden Hour, Neon Glow). Veo가 민감하게 반응하는 중요 요소." }
              }
            },

            "cameraSetting": {
              "type": "object",
              "description": "기본 카메라 설정. 컴파일 시 [카메라 연출] 섹션의 기반이 됨 (Priority 4).",
              "additionalProperties": false,
              "required": ["primaryLens", "dominantMovement", "colorGrade"],
              "properties": {
                "primaryLens": { "type": "string", "minLength": 1, "maxLength": 60, "description": "기본 렌즈 화각 (예: 50mm, 85mm)." },
                "dominantMovement": { "type": "string", "minLength": 1, "maxLength": 60 },
                "colorGrade": { "type": "string", "minLength": 0, "maxLength": 120 },
                "physical": {
                  "type": "object",
                  "additionalProperties": false,
                  "description": "물리적 카메라 설정값. 컴파일러는 프롬프트 희석을 방지하기 위해 시각적 영향이 큰 요소만 선별적으로 포함하거나 대부분 생략해야 함.",
                  "properties": {
                    "aperture": { "type": "string", "minLength": 0, "maxLength": 10 },
                    "shutter": { "type": "string", "minLength": 0, "maxLength": 10 },
                    "iso": { "type": "integer", "minimum": 25, "maximum": 204800 },
                    "ndFilter": { "type": "string", "minLength": 0, "maxLength": 10 }
                  }
                }
              }
            },

            "deliverySpec": {
              "type": "object",
              "additionalProperties": false,
              "required": ["durationMs", "aspectRatio"],
              "properties": {
                "durationMs": { "type": "integer", "minimum": 1 },
                "aspectRatio": { "type": "string", "minLength": 1, "maxLength": 20 },
                "fps": { "type": "number", "minimum": 1, "maximum": 240 },
                "resolution": { "type": "string", "minLength": 1, "maxLength": 20 },
                "shotType": { "type": "string", "minLength": 0, "maxLength": 60 },
                "bitrateHint": { "type": "string", "minLength": 0, "maxLength": 40 }
              }
            },

            "continuity": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "singleTake": { "type": "boolean" },
                "noCuts": { "type": "boolean" },
                "motionVectorContinuity": { "type": "string", "minLength": 0, "maxLength": 200 },
                "textureContinuityNote": { "type": "string", "minLength": 0, "maxLength": 200 },
                "transitionPolicy": { "type": "string", "minLength": 0, "maxLength": 120 }
              }
            },

            "lookDev": {
              "type": "object",
              "description": "룩 개발 및 텍스처 설정. baseStyle과 함께 [스타일/미학] 섹션에 포함됨.",
              "additionalProperties": false,
              "properties": {
                "grade": { "type": "string", "minLength": 0, "maxLength": 120 },
                "grain": { "type": "string", "minLength": 0, "maxLength": 80 },
                "textureTreatment": { "type": "string", "minLength": 0, "maxLength": 120 },
                "lutName": { "type": "string", "minLength": 0, "maxLength": 60 },
                "colorTemperature": { "type": "number", "minimum": 1000, "maximum": 20000 },
                "contrastCurve": { "type": "string", "minLength": 0, "maxLength": 60 }
              }
            },

            "cameraPlan": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "lensRoster": {
                  "type": "array",
                  "items": { "type": "string", "minLength": 1, "maxLength": 60 },
                  "uniqueItems": true,
                  "maxItems": 20
                },
                "movementSummary": { "type": "string", "minLength": 0, "maxLength": 300 },
                "preferredRig": { "type": "string", "minLength": 0, "maxLength": 60 }
              }
            }
          }
        },

        "elements": {
          "type": "object",
          "description": "피사체 정의. 컴파일러는 이 정보를 '요소 사전(Element Dictionary)'으로 구축하여 샷 간의 일관성을 유지하고, [행동/피사체] 섹션에서 참조함.",
          "additionalProperties": false,
          "required": ["characters", "coreObjects"],
          "properties": {
            "characters": {
              "type": "array",
              "maxItems": 50,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["id", "description"],
                "properties": {
                  "id": { "type": "string", "minLength": 1, "maxLength": 60 },
                  "description": { "type": "string", "minLength": 1, "maxLength": 300, "description": "간결하고 시각적인 설명. 예) A grizzled detective (50s) in a long, worn trench coat." },
                  "reference_image_url": { "type": "string", "format": "uri" }
                }
              }
            },
            "coreObjects": {
              "type": "array",
              "maxItems": 100,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["id", "description"],
                "properties": {
                  "id": { "type": "string", "minLength": 1, "maxLength": 60 },
                  "description": { "type": "string", "minLength": 1, "maxLength": 300 },
                  "material": { "type": "string", "minLength": 0, "maxLength": 60 },
                  "reference_image_url": { "type": "string", "format": "uri" }
                }
              }
            },
            "assemblyDirectives": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "sourceContainer": { "type": "string", "minLength": 0, "maxLength": 120 },
                "assembledElements": {
                  "type": "array",
                  "items": { "type": "string", "minLength": 1, "maxLength": 120 },
                  "maxItems": 100
                },
                "animationModel": { "type": "string", "minLength": 0, "maxLength": 120 },
                "physicalityNote": { "type": "string", "minLength": 0, "maxLength": 200 }
              }
            }
          }
        },

        "audioDesign": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "musicIntent": { "type": "string", "minLength": 0, "maxLength": 120 },
            "sfxPalette": {
              "type": "array",
              "items": { "type": "string", "minLength": 1, "maxLength": 80 },
              "maxItems": 50,
              "uniqueItems": true
            },
            "mixNotes": { "type": "string", "minLength": 0, "maxLength": 300 },
            "duckingRules": {
              "type": "array",
              "items": { "type": "string", "minLength": 1, "maxLength": 120 },
              "maxItems": 20
            }
          }
        },

        "timeline": {
          "type": "array",
          "description": "샷 리스트. 컴파일러는 이 배열을 순회하며 각 샷을 처리함. 개별 설정은 metadata보다 우선함.",
          "minItems": 1,
          "maxItems": 500,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "sequence",
              "visualDirecting",
              "cameraWork",
              "pacingFX",
              "audioLayers"
            ],
            "properties": {
              "sequence": { "type": "integer", "minimum": 0 },
              "timestamp": {
                "type": "string",
                "pattern": "^[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?$"
              },
              "timecode": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "startMs": { "type": "integer", "minimum": 0 },
                  "endMs": { "type": "integer", "minimum": 0 },
                  "smpteStart": { "type": "string", "minLength": 0, "maxLength": 12 },
                  "smpteEnd": { "type": "string", "minLength": 0, "maxLength": 12 }
                }
              },
              "visualDirecting": {
                "type": "string",
                "minLength": 1,
                "maxLength": 600,
                "description": "핵심 행동 묘사. 컴파일 시 프롬프트의 가장 앞부분([행동/피사체])에 위치함 (Priority 1). '요소 사전'을 참조해야 함."
              },

              "cameraWork": {
                "type": "object",
                "description": "개별 샷 카메라 연출. 컴파일 시 [카메라 연출] 섹션에 포함됨 (Priority 4).",
                "additionalProperties": false,
                "required": ["angle", "move", "focus"],
                "properties": {
                  "angle": { "type": "string", "minLength": 1, "maxLength": 40 },
                  "move": { "type": "string", "minLength": 1, "maxLength": 40 },
                  "focus": { "type": "string", "minLength": 0, "maxLength": 80 }
                }
              },

              "pacingFX": {
                "type": "object",
                "description": "속도감 및 시각 효과. 컴파일 시 [페이싱/효과] 섹션에 포함됨 (Priority 5).",
                "additionalProperties": false,
                "required": ["pacing", "editingStyle", "visualEffect"],
                "properties": {
                  "pacing": { "type": "string", "minLength": 1, "maxLength": 40 },
                  "editingStyle": { "type": "string", "minLength": 1, "maxLength": 40 },
                  "visualEffect": { "type": "string", "minLength": 1, "maxLength": 60 }
                }
              },

              "audioLayers": {
                "type": "object",
                "description": "오디오 통합 레이어. Veo 3의 오디오 생성을 위해 특정 문법을 적용해야 함. 컴파일 시 [오디오 신호] 섹션에 포함됨.",
                "additionalProperties": false,
                "required": ["diegetic", "non_diegetic", "voice", "concept"],
                "properties": {
                  "diegetic": {
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 200,
                    "description": "현장음(SFX). [Veo 문법] 컴파일러는 대괄호([])를 사용해야 함. 예) [SFX: Creaking floorboards], [SFX: Heavy rain]"
                  },
                  "non_diegetic": {
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 200,
                    "description": "비현장음(음악 등). [Veo 문법] 컴파일러는 대괄호([])를 사용해야 함. 예) [Music: Tense synthesizer music swells]"
                  },
                  "voice": {
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 200,
                    "description": "[매우 중요] 대사. [Veo 문법] 컴파일러는 '화자: 대사 내용.' 형식을 엄수해야 함. 따옴표(\") 사용 금지. 예) Anna: I remember this song."
                  },
                  "concept": { "type": "string", "minLength": 0, "maxLength": 120 }
                }
              },

              "actionNote": { "type": "string", "minLength": 0, "maxLength": 600 },
              "audioNote": { "type": "string", "minLength": 0, "maxLength": 300 },
              "visualNote": { "type": "string", "minLength": 0, "maxLength": 300 }
            }
          }
        }
      }
    },

    "generationControl": {
      "type": "object",
      "description": "생성 제어 및 컴파일 방식 설정.",
      "additionalProperties": false,
      "required": ["directorEmphasis", "shotByShot", "seed"],
      "properties": {
        "directorEmphasis": {
          "type": "array",
          "description": "연출 강조. 컴파일러는 가중치 문법(예: (term:1.2))을 적용하거나 해당 용어를 프롬프트 앞쪽으로 재배치하여 강조할 수 있음.",
          "maxItems": 50,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["term", "weight"],
            "properties": {
              "term": { "type": "string", "minLength": 1, "maxLength": 80 },
              "weight": { "type": "number", "minimum": -3, "maximum": 3 }
            }
          }
        },

        "initializationImage": {
            "type": "object",
            "description": "[Veo 기능 지원] 첫 번째 샷 생성을 위한 초기화 이미지 (Image-to-Video). 선택 사항.",
            "additionalProperties": false,
            "properties": {
              "imageUrl": { "type": "string", "format": "uri" },
              "strength": { "type": "number", "minimum": 0.1, "maximum": 1.0, "description": "초기화 이미지의 영향력 강도." }
            }
        },

        "shotByShot": {
          "type": "object",
          "description": "반복적 생성(Iterative Generation) 및 연속성 관리 설정.",
          "additionalProperties": false,
          "required": ["enabled"],
          "properties": {
            "enabled": { "type": "boolean" },
            "lockedSegments": {
              "type": "array",
              "items": { "type": "integer", "minimum": 0 },
              "uniqueItems": true,
              "maxItems": 500
            },
            "lastFrameData": {
              "type": "object",
              "description": "이전 샷의 마지막 프레임 정보. Veo의 Image-to-Video (Continuation) 모드 호출 시 입력으로 사용되어 샷 간의 시각적 연결을 지원함.",
              "additionalProperties": false,
              "required": ["imageUrl", "description"],
              "properties": {
                "imageUrl": { "type": "string", "format": "uri" },
                "description": { "type": "string", "minLength": 0, "maxLength": 300 }
              }
            }
          }
        },
        "compliance": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "disableTextOverlays": {
                "type": "boolean",
                "default": true,
                "description": "[Veo 최적화] true일 경우, 컴파일러는 최종 프롬프트 마지막([제어 신호])에 '(no subtitles), (no text overlay), (no captions)'를 자동으로 추가함. 특히 대사가 있을 때 강력 권장."
            },
            "brandName": { "type": "string", "minLength": 0, "maxLength": 80 },
            "logoVisibility": { "type": "string", "minLength": 0, "maxLength": 80 },
            "legalRestrictions": {
              "type": "array",
              "items": { "type": "string", "minLength": 1, "maxLength": 120 },
              "maxItems": 50
            },
            "negativeOverlays": {
              "type": "array",
              "items": { "type": "string", "minLength": 1, "maxLength": 120 },
              "maxItems": 50
            }
          }
        },
        "seed": { "type": "integer", "minimum": 0, "maximum": 2147483647 }
      }
    },

    "aiAnalysis": {
      "type": "object",
      "additionalProperties": true,
      "description": "내부 생성 로그",
      "readOnly": true
    },

    "finalOutput": {
      "type": "object",
      "description": "컴파일러의 최종 결과물.",
      "additionalProperties": false,
      "required": ["finalPromptText", "keywords", "negativePrompts"],
      "properties": {
        "finalPromptText": {
          "type": "string",
          "minLength": 1,
          "maxLength": 5000,
          "description": "컴파일된 최종 Veo 프롬프트. Veo 최적화 구조 준수: [행동/피사체] > [장면/환경] > [스타일/미학] > [카메라 연출] > [오디오 신호(Veo 문법)] > [제어 신호]."
        },
        "keywords": {
          "type": "array",
          "maxItems": 200,
          "items": { "type": "string", "minLength": 1, "maxLength": 60 },
          "uniqueItems": true
        },
        "negativePrompts": {
          "type": "array",
          "maxItems": 200,
          "items": { "type": "string", "minLength": 1, "maxLength": 60 },
          "uniqueItems": true
        }
      }
    },

    "uiHints": {
      "type": "object",
      "description": "에디터 권고값. 저장은 선택 사항",
      "writeOnly": true,
      "additionalProperties": {
        "type": "array",
        "items": {
          "oneOf": [
            { "type": "string" },
            { "type": "number" }
          ]
        }
      },
      "properties": {
        "/projectConfig/creationMode": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["VISUAL_FIRST", "SOUND_FIRST"]
        },
        "/projectConfig/frameworkType": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["EVENT_DRIVEN", "DIRECTION_DRIVEN", "HYBRID"]
        },
        "/projectConfig/aiAssistantPersona": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["ASSISTANT_DIRECTOR", "CINEMATOGRAPHER", "SCREENWRITER"]
        },

        "/promptBlueprint/metadata/baseStyle/visualStyle": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Photorealistic",
            "Cinematic",
            "Documentary Style",
            "Glossy Commercial",
            "Lo-Fi VHS",
            "Hand-drawn Animation",
            "Unreal Engine 5 Render"
          ]
        },
        "/promptBlueprint/metadata/baseStyle/genre": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Action-Thriller",
            "Sci-Fi Noir",
            "Fantasy Epic",
            "Slice of Life",
            "Psychological Thriller",
            "Mockumentary",
            "Cyberpunk"
          ]
        },
        "/promptBlueprint/metadata/baseStyle/mood": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Tense",
            "Moody",
            "Serene",
            "Whimsical",
            "Melancholic",
            "Suspenseful",
            "Awe-inspiring",
            "Meditative"
          ]
        },
        "/promptBlueprint/metadata/baseStyle/quality": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["4K", "8K", "IMAX Quality", "HD"]
        },
        "/promptBlueprint/metadata/baseStyle/styleFusion/styleA": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Christopher Nolan",
            "David Fincher",
            "Wes Anderson",
            "Tim Burton",
            "Sofia Coppola",
            "Bong Joon-ho",
            "Denis Villeneuve"
          ]
        },
        "/promptBlueprint/metadata/baseStyle/styleFusion/styleB": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Christopher Nolan",
            "David Fincher",
            "Wes Anderson",
            "Tim Burton",
            "Sofia Coppola",
            "Bong Joon-ho",
            "Denis Villeneuve"
          ]
        },

        "/promptBlueprint/metadata/spatialContext/weather": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["Clear", "Rain", "Heavy Rain", "Snow", "Fog", "Overcast"]
        },
        "/promptBlueprint/metadata/spatialContext/lighting": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Daylight (Midday)",
            "Golden Hour",
            "Night",
            "Studio Lighting",
            "Harsh Midday Sun",
            "Single Key Light (Rembrandt)",
            "Backlit Silhouette",
            "Neon Glow"
          ]
        },

        "/promptBlueprint/metadata/cameraSetting/primaryLens": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "14mm Ultra-Wide",
            "24mm Wide-angle",
            "35mm (Natural)",
            "50mm Standard",
            "85mm Portrait",
            "90mm Macro"
          ]
        },
        "/promptBlueprint/metadata/cameraSetting/dominantMovement": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Static Shot",
            "Shaky Handheld",
            "Smooth Tracking (Dolly)",
            "Whip Pan",
            "Jib/Crane Shot",
            "Drone Fly-over",
            "Vertigo Effect (Dolly Zoom)"
          ]
        },

        "/promptBlueprint/metadata/deliverySpec/aspectRatio": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["9:16", "1:1", "4:5", "16:9", "2.39:1"]
        },
        "/promptBlueprint/metadata/deliverySpec/fps": {
          "type": "array",
          "items": { "type": "number" },
          "default": [24, 25, 30, 50, 60]
        },
        "/promptBlueprint/metadata/deliverySpec/resolution": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["HD", "FHD", "4K", "8K"]
        },

        "/promptBlueprint/metadata/continuity/transitionPolicy": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["None", "Only-internal time ramp", "No editorial transitions"]
        },

        "/promptBlueprint/metadata/lookDev/grain": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["None", "Fine cinematic", "Medium 35mm", "Coarse 16mm"]
        },

        "/promptBlueprint/metadata/cameraPlan/preferredRig": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["Handheld", "Dolly", "Gimbal", "Crane", "Drone"]
        },

        "/promptBlueprint/audioDesign/sfxPalette": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["ASMR clicks", "Rustle", "Snap", "Whoosh", "Drone pad"]
        },

        "/promptBlueprint/timeline/*/cameraWork/angle": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Wide Shot (WS)",
            "Medium Shot (MS)",
            "Close Up (CU)",
            "Extreme Close Up (ECU)",
            "Point of View (POV)"
          ]
        },
        "/promptBlueprint/timeline/*/cameraWork/move": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Pan (Left/Right)",
            "Tilt (Up/Down)",
            "Dolly (In/Out)",
            "Tracking (Follow)",
            "Whip Pan",
            "Static Shot"
          ]
        },
        "/promptBlueprint/timeline/*/pacingFX/pacing": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Real-time",
            "Slow-motion (0.5x)",
            "Fast-motion (2x)",
            "Time-lapse",
            "Freeze-frame"
          ]
        },
        "/promptBlueprint/timeline/*/pacingFX/editingStyle": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Standard Cut",
            "Match Cut",
            "Jump Cut",
            "Cross-dissolve",
            "Wipe",
            "Split Screen"
          ]
        },
        "/promptBlueprint/timeline/*/pacingFX/visualEffect": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "None",
            "Lens Flare",
            "Light Leaks",
            "Film Grain",
            "Chromatic Aberration",
            "Slow Shutter (Motion Blur)"
          ]
        },
        "/promptBlueprint/timeline/*/audioLayers/concept": {
          "type": "array",
          "items": { "type": "string" },
          "default": [
            "Muffled Underwater Audio",
            "Heartbeat Rhythm",
            "High-frequency Ringing",
            "Glitchy Digital Noise",
            "Warm Vinyl Crackle"
          ]
        }
      }
    }
  },

  "allOf": [
    {
      "if": {
        "properties": {
          "promptBlueprint": {
            "properties": {
              "metadata": {
                "properties": {
                  "continuity": {
                    "properties": { "noCuts": { "const": true } },
                    "required": ["noCuts"]
                  }
                }
              }
            }
          }
        },
        "required": ["promptBlueprint"]
      },
      "then": {
        "properties": {
          "promptBlueprint": {
            "properties": {
              "timeline": {
                "items": {
                  "properties": {
                    "pacingFX": {
                      "properties": {
                        "editingStyle": {
                          "not": { "enum": ["Jump Cut", "Cross-dissolve", "Wipe", "Split Screen"] }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]
}