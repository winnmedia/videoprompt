다음은 VLANET Prompt v1.0 최종 JSON 스키마입니다. 요청하신 명칭 변경과 함께 제안드렸던 보강 항목을 선택 필드로 통합하였습니다. 기존 스키마와의 하위 호환을 유지하며, 새로 추가된 필드는 모두 선택 항목입니다.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vlanet.app/schemas/vlanet-prompt.v1.0.json",
  "title": "VLANET Prompt v1.0 Canonical Model (Veo 3 Optimized + Compact Prompt)",
  "description": "VLANET Prompt 데이터 모델 v1.0. Veo 3 최적화 규칙을 유지하면서, 간결 포맷(finalOutputCompact) 출력도 지원.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "projectId",
    "createdAt",
    "userInput",
    "projectConfig",
    "promptBlueprint",
    "generationControl"
  ],
  "properties": {
    "version": { "type": "string", "const": "1.0" },

    "projectId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
      "description": "UUID v4 형식 문자열"
    },

    "createdAt": { "type": "string", "format": "date-time" },

    "userInput": {
      "type": "object",
      "additionalProperties": false,
      "required": ["oneLineScenario"],
      "properties": {
        "oneLineScenario": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500
        },
        "targetAudience": {
          "type": "string",
          "minLength": 0,
          "maxLength": 200
        },
        "referenceUrls": {
          "type": "array",
          "items": { "type": "string", "format": "uri" },
          "maxItems": 20,
          "uniqueItems": true
        },
        "referenceAudioUrl": { "type": "string", "format": "uri" },

        "referenceSnapshots": {
          "type": "array",
          "description": "외부 참조 자산의 스냅샷 메타데이터",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["url", "sha256", "fetchedAt"],
            "properties": {
              "url": { "type": "string", "format": "uri" },
              "sha256": {
                "type": "string",
                "pattern": "^[0-9a-fA-F]{64}$",
                "description": "SHA256 해시 (64자 헥스)"
              },
              "fetchedAt": { "type": "string", "format": "date-time" },
              "mimeType": { "type": "string", "minLength": 0, "maxLength": 100 }
            }
          },
          "maxItems": 200
        }
      }
    },

    "projectConfig": {
      "type": "object",
      "additionalProperties": false,
      "required": ["creationMode", "frameworkType", "aiAssistantPersona"],
      "properties": {
        "creationMode": {
          "type": "string",
          "enum": ["VISUAL_FIRST", "SOUND_FIRST"]
        },
        "frameworkType": {
          "type": "string",
          "enum": ["EVENT_DRIVEN", "DIRECTION_DRIVEN", "HYBRID"]
        },
        "aiAssistantPersona": {
          "type": "string",
          "enum": ["ASSISTANT_DIRECTOR", "CINEMATOGRAPHER", "SCREENWRITER"]
        },
        "profileId": { "type": "string", "minLength": 0, "maxLength": 60 }
      }
    },

    "profiles": {
      "type": "array",
      "description": "선택. 조직용 프리셋 프로파일 레지스트리",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name"],
        "properties": {
          "name": { "type": "string", "minLength": 1, "maxLength": 80 },
          "lockedFields": {
            "type": "array",
            "items": { "type": "string", "minLength": 1, "maxLength": 200 },
            "maxItems": 200,
            "uniqueItems": true
          },
          "overrides": {
            "type": "object",
            "description": "스키마 경로 기반 덮어쓰기 (JSON Pointer 패턴)",
            "additionalProperties": false,
            "patternProperties": {
              "^/[a-zA-Z0-9/_-]+$": {
                "oneOf": [
                  { "type": "string" },
                  { "type": "number" },
                  { "type": "boolean" },
                  { "type": "array" }
                ]
              }
            }
          }
        }
      },
      "maxItems": 100
    },

    "brandPolicies": {
      "type": "array",
      "description": "선택. 브랜드 컴플라이언스 정책 레지스트리",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id"],
        "properties": {
          "id": { "type": "string", "minLength": 1, "maxLength": 60 },
          "logoRules": { "type": "string", "minLength": 0, "maxLength": 300 },
          "colorUsage": { "type": "string", "minLength": 0, "maxLength": 200 },
          "negativeOverlays": {
            "type": "array",
            "items": { "type": "string", "minLength": 1, "maxLength": 120 },
            "maxItems": 50
          },
          "legalNotes": { "type": "string", "minLength": 0, "maxLength": 300 }
        }
      },
      "maxItems": 50
    },

    "promptBlueprint": {
      "type": "object",
      "additionalProperties": false,
      "required": ["metadata", "elements", "timeline"],
      "properties": {
        "metadata": {
          "type": "object",
          "description": "전역 설정. timeline의 개별 설정에 의해 오버라이드될 수 있음.",
          "additionalProperties": false,
          "required": [
            "promptName",
            "baseStyle",
            "spatialContext",
            "cameraSetting",
            "deliverySpec"
          ],
          "properties": {
            "promptName": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },

            "baseStyle": {
              "type": "object",
              "description": "시각적 미학 정의.",
              "additionalProperties": false,
              "required": [
                "visualStyle",
                "genre",
                "mood",
                "quality",
                "styleFusion"
              ],
              "properties": {
                "visualStyle": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                },
                "genre": { "type": "string", "minLength": 1, "maxLength": 80 },
                "mood": { "type": "string", "minLength": 1, "maxLength": 80 },
                "quality": {
                  "type": "string",
                  "enum": ["4K", "8K", "IMAX Quality", "HD"]
                },
                "styleFusion": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["styleA", "styleB", "ratio"],
                  "properties": {
                    "styleA": {
                      "type": "string",
                      "enum": [
                        "Christopher Nolan",
                        "David Fincher",
                        "Wes Anderson",
                        "Tim Burton",
                        "Sofia Coppola",
                        "Bong Joon-ho",
                        "Denis Villeneuve"
                      ]
                    },
                    "styleB": {
                      "type": "string",
                      "enum": [
                        "Christopher Nolan",
                        "David Fincher",
                        "Wes Anderson",
                        "Tim Burton",
                        "Sofia Coppola",
                        "Bong Joon-ho",
                        "Denis Villeneuve"
                      ]
                    },
                    "ratio": { "type": "number", "minimum": 0, "maximum": 1 }
                  }
                }
              }
            },

            "spatialContext": {
              "type": "object",
              "description": "장면 및 환경 정의.",
              "additionalProperties": false,
              "required": ["placeDescription", "weather", "lighting"],
              "properties": {
                "placeDescription": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                },
                "weather": {
                  "type": "string",
                  "enum": [
                    "Clear",
                    "Rain",
                    "Heavy Rain",
                    "Snow",
                    "Fog",
                    "Overcast"
                  ]
                },
                "lighting": {
                  "type": "string",
                  "enum": [
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
                "regionTag": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 80
                }
              }
            },

            "cameraSetting": {
              "type": "object",
              "description": "기본 카메라 설정.",
              "additionalProperties": false,
              "required": ["primaryLens", "dominantMovement", "colorGrade"],
              "properties": {
                "primaryLens": {
                  "type": "string",
                  "enum": [
                    "14mm Ultra-Wide",
                    "24mm Wide-angle",
                    "35mm (Natural)",
                    "50mm Standard",
                    "85mm Portrait",
                    "90mm Macro"
                  ]
                },
                "dominantMovement": {
                  "type": "string",
                  "enum": [
                    "Static Shot",
                    "Shaky Handheld",
                    "Smooth Tracking (Dolly)",
                    "Whip Pan",
                    "Jib/Crane Shot",
                    "Drone Fly-over",
                    "Vertigo Effect (Dolly Zoom)"
                  ]
                },
                "colorGrade": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 120
                },
                "physical": {
                  "type": "object",
                  "additionalProperties": false,
                  "description": "물리적 카메라 설정값.",
                  "properties": {
                    "aperture": {
                      "type": "string",
                      "pattern": "^f\\/?(\\d+(\\.\\d+)?)$"
                    },
                    "shutter": {
                      "type": "string",
                      "pattern": "^(\\d+(\\.\\d+)?s)|(1\\/\\d+)$"
                    },
                    "iso": {
                      "type": "integer",
                      "minimum": 25,
                      "maximum": 204800
                    },
                    "ndFilter": {
                      "type": "string",
                      "pattern": "^ND(\\d+|\\d*\\.\\d+)$"
                    }
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
                "aspectRatio": {
                  "type": "string",
                  "enum": ["9:16", "1:1", "4:5", "16:9", "2.39:1"]
                },
                "fps": { "type": "number", "enum": [24, 25, 30, 50, 60] },
                "resolution": {
                  "type": "string",
                  "enum": ["HD", "FHD", "4K", "8K"]
                },
                "shotType": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 60
                },
                "bitrateHint": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 40
                }
              }
            },

            "continuity": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "singleTake": { "type": "boolean" },
                "noCuts": { "type": "boolean" },
                "motionVectorContinuity": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 200
                },
                "textureContinuityNote": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 200
                },
                "transitionPolicy": {
                  "type": "string",
                  "enum": [
                    "None",
                    "Only-internal time ramp",
                    "No editorial transitions"
                  ]
                }
              }
            },

            "lookDev": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "grade": { "type": "string", "minLength": 0, "maxLength": 120 },
                "grain": {
                  "type": "string",
                  "enum": [
                    "None",
                    "Fine cinematic",
                    "Medium 35mm",
                    "Coarse 16mm"
                  ]
                },
                "textureTreatment": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 120
                },
                "lutName": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 60
                },
                "colorTemperature": {
                  "type": "number",
                  "minimum": 1000,
                  "maximum": 20000
                },
                "contrastCurve": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 60
                }
              }
            },

            "cameraPlan": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "lensRoster": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 60
                  },
                  "uniqueItems": true,
                  "maxItems": 20
                },
                "movementSummary": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 300
                },
                "preferredRig": {
                  "type": "string",
                  "enum": ["Handheld", "Dolly", "Gimbal", "Crane", "Drone"]
                }
              }
            }
          }
        },

        "elements": {
          "type": "object",
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
                  "description": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  },
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
                  "description": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  },
                  "material": {
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 60
                  },
                  "reference_image_url": { "type": "string", "format": "uri" }
                }
              }
            },
            "assemblyDirectives": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "sourceContainer": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 120
                },
                "assembledElements": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 120
                  },
                  "maxItems": 100
                },
                "animationModel": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 120
                },
                "physicalityNote": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 200
                }
              }
            }
          }
        },

        "audioDesign": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "musicIntent": {
              "type": "string",
              "minLength": 0,
              "maxLength": 120
            },
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
            },
            "grammarPolicy": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "autoWrapDiegetic": { "type": "boolean", "default": true },
                "autoWrapNonDiegetic": { "type": "boolean", "default": true },
                "musicKeywords": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 40
                  },
                  "maxItems": 50,
                  "uniqueItems": true
                }
              }
            }
          }
        },

        "timeline": {
          "type": "array",
          "description": "샷 리스트. 시퀀스 번호는 중복 불가.",
          "minItems": 1,
          "maxItems": 500,
          "uniqueItems": true,
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
                "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,3})?$"
              },

              "timecode": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "startMs": { "type": "integer", "minimum": 0 },
                  "endMs": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "endMs는 startMs보다 커야 함"
                  },
                  "smpteStart": {
                    "type": "string",
                    "pattern": "^\\d{2}:\\d{2}:\\d{2}:\\d{2}$"
                  },
                  "smpteEnd": {
                    "type": "string",
                    "pattern": "^\\d{2}:\\d{2}:\\d{2}:\\d{2}$"
                  }
                },
                "if": {
                  "properties": {
                    "startMs": { "type": "integer" },
                    "endMs": { "type": "integer" }
                  },
                  "required": ["startMs", "endMs"]
                },
                "then": {
                  "properties": {
                    "endMs": { "minimum": { "$data": "1/startMs" } }
                  }
                }
              },

              "visualDirecting": {
                "type": "string",
                "minLength": 1,
                "maxLength": 600
              },

              "cameraWork": {
                "type": "object",
                "additionalProperties": false,
                "required": ["angle", "move", "focus"],
                "properties": {
                  "angle": {
                    "type": "string",
                    "enum": [
                      "Wide Shot (WS)",
                      "Medium Shot (MS)",
                      "Close Up (CU)",
                      "Extreme Close Up (ECU)",
                      "Point of View (POV)"
                    ]
                  },
                  "move": {
                    "type": "string",
                    "enum": [
                      "Pan (Left/Right)",
                      "Tilt (Up/Down)",
                      "Dolly (In/Out)",
                      "Tracking (Follow)",
                      "Whip Pan",
                      "Static Shot"
                    ]
                  },
                  "focus": { "type": "string", "minLength": 0, "maxLength": 80 }
                }
              },

              "pacingFX": {
                "type": "object",
                "additionalProperties": false,
                "required": ["pacing", "editingStyle", "visualEffect"],
                "properties": {
                  "pacing": {
                    "type": "string",
                    "enum": [
                      "Real-time",
                      "Slow-motion (0.5x)",
                      "Fast-motion (2x)",
                      "Time-lapse",
                      "Freeze-frame"
                    ]
                  },
                  "editingStyle": {
                    "type": "string",
                    "enum": [
                      "None",
                      "Only-internal time ramp",
                      "Standard Cut",
                      "Match Cut",
                      "Jump Cut",
                      "Cross-dissolve",
                      "Wipe",
                      "Split Screen"
                    ]
                  },
                  "visualEffect": {
                    "type": "string",
                    "enum": [
                      "None",
                      "Lens Flare",
                      "Light Leaks",
                      "Film Grain",
                      "Chromatic Aberration",
                      "Slow Shutter (Motion Blur)"
                    ]
                  }
                }
              },

              "audioLayers": {
                "type": "object",
                "description": "Veo 3 문법.",
                "additionalProperties": false,
                "required": ["diegetic", "non_diegetic", "voice", "concept"],
                "properties": {
                  "diegetic": {
                    "type": "string",
                    "anyOf": [
                      { "maxLength": 0 },
                      { "pattern": "^\\[SFX:\\s?.+\\]$" }
                    ]
                  },
                  "non_diegetic": {
                    "type": "string",
                    "anyOf": [
                      { "maxLength": 0 },
                      { "pattern": "^\\[(Music|Score):\\s?.+\\]$" }
                    ]
                  },
                  "voice": {
                    "type": "string",
                    "anyOf": [
                      { "maxLength": 0 },
                      { "pattern": "^[^:\"]{1,40}:\\s[^\\\"]+$" }
                    ]
                  },
                  "concept": {
                    "type": "string",
                    "anyOf": [
                      { "maxLength": 0 },
                      {
                        "enum": [
                          "Muffled Underwater Audio",
                          "Heartbeat Rhythm",
                          "High-frequency Ringing",
                          "Glitchy Digital Noise",
                          "Warm Vinyl Crackle"
                        ]
                      }
                    ]
                  }
                }
              },

              "actionNote": {
                "type": "string",
                "minLength": 0,
                "maxLength": 600
              },
              "audioNote": {
                "type": "string",
                "minLength": 0,
                "maxLength": 300
              },
              "visualNote": {
                "type": "string",
                "minLength": 0,
                "maxLength": 300
              }
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
          "additionalProperties": false,
          "properties": {
            "imageUrl": { "type": "string", "format": "uri" },
            "strength": { "type": "number", "minimum": 0.1, "maximum": 1.0 }
          }
        },

        "shotByShot": {
          "type": "object",
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
              "additionalProperties": false,
              "required": ["imageUrl", "description"],
              "properties": {
                "imageUrl": { "type": "string", "format": "uri" },
                "description": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 300
                }
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
              "description": "true이면 '(no subtitles), (no text overlay), (no captions)' 자동 부가."
            },
            "brandName": { "type": "string", "minLength": 0, "maxLength": 80 },
            "logoVisibility": {
              "type": "string",
              "minLength": 0,
              "maxLength": 80
            },
            "legalRestrictions": {
              "type": "array",
              "items": { "type": "string", "minLength": 1, "maxLength": 120 },
              "maxItems": 50
            },
            "negativeOverlays": {
              "type": "array",
              "items": { "type": "string", "minLength": 1, "maxLength": 120 },
              "maxItems": 50
            },
            "brandPolicyId": {
              "type": "string",
              "minLength": 0,
              "maxLength": 60
            },
            "culturalConstraints": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "allowedMotifs": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "maxItems": 50
                },
                "disallowedMotifs": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "maxItems": 50
                },
                "regionLocale": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 40
                }
              }
            }
          }
        },

        "seed": { "type": "integer", "minimum": 0, "maximum": 2147483647 }
      }
    },

    "reproducibility": {
      "type": "object",
      "description": "선택. 재현성 메타데이터",
      "additionalProperties": false,
      "properties": {
        "promptHash": { "type": "string", "minLength": 64, "maxLength": 128 },
        "schemaVersion": { "type": "string", "minLength": 1, "maxLength": 20 },
        "toolchain": { "type": "string", "minLength": 0, "maxLength": 120 },
        "randomSeedPolicy": {
          "type": "string",
          "enum": ["FIXED", "SEMI_FIXED", "UNFIXED"]
        }
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
      "description": "기존 상세형 Veo 출력.",
      "additionalProperties": false,
      "required": ["finalPromptText", "keywords", "negativePrompts"],
      "properties": {
        "finalPromptText": {
          "type": "string",
          "minLength": 1,
          "maxLength": 5000
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

    "finalOutputCompact": {
      "type": "object",
      "description": "간결 포맷 출력. 사용자 제시 구조와 호환.",
      "additionalProperties": false,
      "required": [
        "metadata",
        "key_elements",
        "assembled_elements",
        "negative_prompts",
        "timeline",
        "text",
        "keywords"
      ],
      "properties": {
        "metadata": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "prompt_name",
            "base_style",
            "aspect_ratio",
            "room_description",
            "camera_setup"
          ],
          "properties": {
            "prompt_name": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },
            "base_style": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "aspect_ratio": {
              "type": "string",
              "pattern": "^(?:\\d+(?:\\.\\d+)?):(\\d+)$",
              "description": "예: 9:16, 16:9, 21:9, 2.39:1"
            },
            "room_description": {
              "type": "string",
              "minLength": 1,
              "maxLength": 800
            },
            "camera_setup": {
              "type": "string",
              "minLength": 1,
              "maxLength": 800
            }
          }
        },
        "key_elements": {
          "type": "array",
          "items": { "type": "string", "minLength": 1, "maxLength": 200 },
          "maxItems": 50
        },
        "assembled_elements": {
          "type": "array",
          "items": { "type": "string", "minLength": 1, "maxLength": 200 },
          "maxItems": 30
        },
        "negative_prompts": {
          "type": "array",
          "items": { "type": "string", "minLength": 1, "maxLength": 120 },
          "maxItems": 50
        },
        "timeline": {
          "type": "array",
          "minItems": 1,
          "maxItems": 100,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["sequence", "timestamp", "action", "audio"],
            "properties": {
              "sequence": { "type": "integer", "minimum": 1 },
              "timestamp": {
                "type": "string",
                "pattern": "^[0-5]\\d:[0-5]\\d-[0-5]\\d:[0-5]\\d",
                "description": "mm:ss-mm:ss 범위. 예: 00:00-00:02"
              },
              "action": { "type": "string", "minLength": 1, "maxLength": 800 },
              "audio": { "type": "string", "minLength": 1, "maxLength": 600 }
            }
          }
        },
        "text": {
          "type": "string",
          "minLength": 0,
          "maxLength": 5000,
          "description": "프롬프트 텍스트 설명 또는 'none'"
        },
        "keywords": {
          "type": "array",
          "items": { "type": "string", "minLength": 1, "maxLength": 80 },
          "maxItems": 50,
          "uniqueItems": true
        }
      }
    },

    "uiHints": {
      "type": "object",
      "description": "에디터 권고값 및 매핑 힌트. 저장은 선택 사항",
      "writeOnly": true,
      "additionalProperties": {
        "type": "array",
        "items": {
          "oneOf": [{ "type": "string" }, { "type": "number" }]
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
          "default": [
            "None",
            "Only-internal time ramp",
            "No editorial transitions"
          ]
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
            "None",
            "Only-internal time ramp",
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
        },

        "_mappings": {
          "type": "object",
          "description": "정규화 매핑 힌트",
          "additionalProperties": false,
          "properties": {
            "aspectRatio": {
              "type": "array",
              "description": "compact → blueprint 매핑 테이블",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["compact", "blueprint"],
                "properties": {
                  "compact": {
                    "type": "string",
                    "pattern": "^(?:\\d+(?:\\.\\d+)?):(\\d+)$"
                  },
                  "blueprint": {
                    "type": "string",
                    "enum": ["9:16", "1:1", "4:5", "16:9", "2.39:1"]
                  }
                }
              },
              "default": [
                { "compact": "21:9", "blueprint": "2.39:1" },
                { "compact": "16:9", "blueprint": "16:9" },
                { "compact": "9:16", "blueprint": "9:16" },
                { "compact": "1:1", "blueprint": "1:1" },
                { "compact": "4:5", "blueprint": "4:5" }
              ]
            }
          }
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
                          "enum": ["None", "Only-internal time ramp"]
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
    },
    {
      "if": {
        "properties": {
          "generationControl": {
            "properties": {
              "shotByShot": {
                "properties": { "enabled": { "const": true } },
                "required": ["enabled"]
              }
            },
            "required": ["shotByShot"]
          }
        },
        "required": ["generationControl"]
      },
      "then": {
        "properties": {
          "generationControl": {
            "properties": {
              "shotByShot": {
                "anyOf": [
                  { "required": ["lockedSegments"] },
                  { "required": ["lastFrameData"] }
                ]
              }
            }
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "projectConfig": {
            "properties": {
              "profileId": { "minLength": 1 }
            },
            "required": ["profileId"]
          }
        },
        "required": ["projectConfig"]
      },
      "then": {
        "required": ["profiles"],
        "properties": {
          "profiles": {
            "minItems": 1,
            "contains": {
              "properties": {
                "name": { "$data": "4/projectConfig/profileId" }
              }
            }
          }
        }
      }
    }
  ],

  "oneOf": [
    { "required": ["finalOutput"] },
    { "required": ["finalOutputCompact"] }
  ]
}
```
