
1. videoplanet ai prompt json 
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cinegenius.app/schemas/cinegenius-v3.1.final.json",
  "title": "CineGenius v3.1 Canonical Model (with UI Hints)",
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
          "additionalProperties": false,
          "required": ["promptName", "baseStyle", "spatialContext", "cameraSetting", "deliverySpec"],
          "properties": {
            "promptName": { "type": "string", "minLength": 1, "maxLength": 120 },

            "baseStyle": {
              "type": "object",
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
              "additionalProperties": false,
              "required": ["placeDescription", "weather", "lighting"],
              "properties": {
                "placeDescription": { "type": "string", "minLength": 1, "maxLength": 300 },
                "weather": { "type": "string", "minLength": 1, "maxLength": 40 },
                "lighting": { "type": "string", "minLength": 1, "maxLength": 60 }
              }
            },

            "cameraSetting": {
              "type": "object",
              "additionalProperties": false,
              "required": ["primaryLens", "dominantMovement", "colorGrade"],
              "properties": {
                "primaryLens": { "type": "string", "minLength": 1, "maxLength": 60 },
                "dominantMovement": { "type": "string", "minLength": 1, "maxLength": 60 },
                "colorGrade": { "type": "string", "minLength": 0, "maxLength": 120 },
                "physical": {
                  "type": "object",
                  "additionalProperties": false,
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
                  "description": { "type": "string", "minLength": 1, "maxLength": 300 },
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
              "visualDirecting": { "type": "string", "minLength": 1, "maxLength": 600 },

              "cameraWork": {
                "type": "object",
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
                "additionalProperties": false,
                "required": ["diegetic", "non_diegetic", "voice", "concept"],
                "properties": {
                  "diegetic": { "type": "string", "minLength": 0, "maxLength": 200 },
                  "non_diegetic": { "type": "string", "minLength": 0, "maxLength": 200 },
                  "voice": { "type": "string", "minLength": 0, "maxLength": 200 },
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
                "description": { "type": "string", "minLength": 0, "maxLength": 300 }
              }
            }
          }
        },
        "compliance": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
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
      "additionalProperties": false,
      "required": ["finalPromptText", "keywords", "negativePrompts"],
      "properties": {
        "finalPromptText": { "type": "string", "minLength": 1, "maxLength": 5000 },
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



2. 스키마 증분 패치

아래 패치는 기존 스키마에 병합하는 증분이다. 본문에 제시된 경로에 그대로 추가하거나 대체한다. 표기 방식은 JSON Schema 2020-12이며, 기존 키의 값 일부를 교체하는 경우 동일 경로에 대입한다.

2.1 공용 정의 추가
{
  "$defs": {
    "SMPTETimecode": {
      "type": "string",
      "pattern": "^[0-9]{2}:[0-9]{2}:[0-9]{2}([:;][0-9]{2})$",
      "description": "HH:MM:SS:FF 또는 HH:MM:SS;FF"
    },
    "AspectRatio": {
      "type": "string",
      "pattern": "^(\\d+(?:\\.\\d+)?):(\\d+(?:\\.\\d+)?)$",
      "description": "예시 16:9, 9:16, 2.39:1"
    },
    "Resolution": {
      "type": "string",
      "pattern": "^((HD|FHD|4K|8K)|([1-9]\\d{2,4}x[1-9]\\d{2,4}))$",
      "description": "명칭 또는 WxH 픽셀 표기"
    },
    "Aperture": {
      "type": "string",
      "pattern": "^f\\/(\\d+(?:\\.\\d+)?)$",
      "description": "예시 f/1.4, f/5.6"
    },
    "Shutter": {
      "type": "string",
      "pattern": "^(1\\/[1-9]\\d{1,5}|[0-9]+(?:\\.[0-9]+)?s)$",
      "description": "예시 1/50, 1/1000, 0.5s"
    },
    "NDFilter": {
      "type": "string",
      "pattern": "^(ND\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?\\s*stops)$",
      "description": "예시 ND8, ND0.9, 3 stops"
    }
  }
}

2.2 타임라인 시간 존재 보장

promptBlueprint.properties.timeline.items 내부에 다음을 추가한다.

{
  "anyOf": [
    { "required": ["timestamp"] },
    { "required": ["timecode"] }
  ]
}

2.3 SMPTE 정규식 적용

timecode.smpteStart, timecode.smpteEnd 정의를 다음과 같이 교체한다.

{
  "smpteStart": { "$ref": "#/$defs/SMPTETimecode" },
  "smpteEnd":   { "$ref": "#/$defs/SMPTETimecode" }
}

2.4 화면비·해상도 패턴 적용

metadata.deliverySpec.properties.aspectRatio와 resolution을 다음과 같이 교체한다.

{
  "aspectRatio": { "$ref": "#/$defs/AspectRatio" },
  "resolution":  { "$ref": "#/$defs/Resolution" }
}


fps는 23.976 등 비정수 프레임을 위해 number 유지가 타당하다.

2.5 물리 카메라 파라미터 패턴 적용

metadata.cameraSetting.physical.properties를 다음과 같이 교체한다.

{
  "aperture": { "$ref": "#/$defs/Aperture" },
  "shutter":  { "$ref": "#/$defs/Shutter" },
  "iso":      { "type": "integer", "minimum": 25, "maximum": 204800 },
  "ndFilter": { "$ref": "#/$defs/NDFilter" }
}

2.6 무컷 연속성과 페이싱의 연동

스키마 하단 allOf 블록을 아래와 같이 확장한다. noCuts = true이면서 transitionPolicy가 명시되지 않았거나 None인 경우, 시간 왜곡 페이싱을 금지한다. 반대로 Only-internal time ramp인 경우에는 허용한다.

{
  "allOf": [
    {
      "if": {
        "properties": {
          "promptBlueprint": {
            "properties": {
              "metadata": {
                "properties": {
                  "continuity": {
                    "properties": { "noCuts": { "const": true } }
                  }
                },
                "required": ["continuity"]
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
    },
    {
      "if": {
        "properties": {
          "promptBlueprint": {
            "properties": {
              "metadata": {
                "properties": {
                  "continuity": {
                    "properties": {
                      "noCuts": { "const": true },
                      "transitionPolicy": { "enum": ["None"] }
                    }
                  }
                }
              }
            }
          }
        }
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
                        "pacing": {
                          "not": { "enum": ["Time-lapse", "Freeze-frame"] }
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

2.7 UI 힌트 확장성 확보

uiHints에 patternProperties를 추가하여 임의의 JSON Pointer 키를 안전하게 수용하도록 한다. 기존 properties에 둔 기본값 목록은 유지해도 무방하다.

{
  "uiHints": {
    "type": "object",
    "writeOnly": true,
    "patternProperties": {
      "^\\/.*$": {
        "type": "array",
        "items": {
          "oneOf": [
            { "type": "string" },
            { "type": "number" }
          ]
        }
      }
    },
    "additionalProperties": false,
    "properties": {
      "... 기존 기본값 나열부 유지 ..."
    }
  }
}

1. 필수 보강 사항

타임라인 각 항목의 시간 존재 보장
현재 timestamp와 timecode가 모두 선택 항목이므로, 실제 시간 정보 없이 저장될 위험이 있다. 최소 하나는 필수임을 강제하는 규칙이 필요하다.

무컷 연속성 규칙의 정밀화
continuity.noCuts = true일 때 이미 편집 전환을 금지하고 있으나, 시간 왜곡류 페이싱 값의 허용 범위를 transitionPolicy와 연동해야 한다.

화면비와 해상도의 정규 패턴
aspectRatio, resolution을 자유 텍스트로 두면 파이프라인 매핑이 불안정해진다. SMPTE 스타일 정규식과 함께 권장 패턴을 추가한다.

SMPTE 타임코드 정규식
timecode.smpteStart, smpteEnd의 형식을 엄격히 제한하여 파싱 오류를 방지한다.

물리 카메라 파라미터의 형식 규정
aperture, shutter, ndFilter는 문자열로 개방되어 있다. 사진·영화 표기 규약 기반 패턴을 부여한다. iso는 정수 범위로 충분하다.

컬러 그레이드 중복 정의의 우선순위
cameraSetting.colorGrade와 lookDev.grade가 중복될 수 있다. 충돌 시 우선순위를 명시한다. 스키마 주석과 운영 규칙에 포함할 것을 권고한다.

타임라인 순차성 및 구간 유효성
JSON Schema 자체로는 교차 필드 비교가 어려우므로 서비스 계층 규칙으로 강제한다. sequence의 유일성, startMs < endMs, 구간 겹침 금지를 포함한다.

잠금 세그먼트 참조 무결성
generationControl.shotByShot.lockedSegments가 실제 타임라인 시퀀스만 가리키도록 서비스 계층에서 교차 검증을 추가한다.

요소 식별자의 유일성
elements.characters[].id, elements.coreObjects[].id의 유일성은 데이터베이스 또는 서비스 계층에서 강제한다.

uiHints 구조의 범용성
현재 uiHints.properties에 JSON Pointer 키를 명시적으로 열거하였다. 유지보수성과 확장성을 위해 patternProperties를 병행하여 임의의 포인터 키를 안전하게 수용하도록 한다.

주의 사항. 기존 스키마의 uiHints.additionalProperties는 임의 키 허용이었으나, 포인터 키만 허용하도록 강화하는 편이 안전하다. 필드명 오탈자 유입을 줄일 수 있다.


2. 스키마 증분 패치

아래 패치는 기존 스키마에 병합하는 증분이다. 본문에 제시된 경로에 그대로 추가하거나 대체한다. 표기 방식은 JSON Schema 2020-12이며, 기존 키의 값 일부를 교체하는 경우 동일 경로에 대입한다.

2.1 공용 정의 추가
{
  "$defs": {
    "SMPTETimecode": {
      "type": "string",
      "pattern": "^[0-9]{2}:[0-9]{2}:[0-9]{2}([:;][0-9]{2})$",
      "description": "HH:MM:SS:FF 또는 HH:MM:SS;FF"
    },
    "AspectRatio": {
      "type": "string",
      "pattern": "^(\\d+(?:\\.\\d+)?):(\\d+(?:\\.\\d+)?)$",
      "description": "예시 16:9, 9:16, 2.39:1"
    },
    "Resolution": {
      "type": "string",
      "pattern": "^((HD|FHD|4K|8K)|([1-9]\\d{2,4}x[1-9]\\d{2,4}))$",
      "description": "명칭 또는 WxH 픽셀 표기"
    },
    "Aperture": {
      "type": "string",
      "pattern": "^f\\/(\\d+(?:\\.\\d+)?)$",
      "description": "예시 f/1.4, f/5.6"
    },
    "Shutter": {
      "type": "string",
      "pattern": "^(1\\/[1-9]\\d{1,5}|[0-9]+(?:\\.[0-9]+)?s)$",
      "description": "예시 1/50, 1/1000, 0.5s"
    },
    "NDFilter": {
      "type": "string",
      "pattern": "^(ND\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?\\s*stops)$",
      "description": "예시 ND8, ND0.9, 3 stops"
    }
  }
}

2.2 타임라인 시간 존재 보장

promptBlueprint.properties.timeline.items 내부에 다음을 추가한다.

{
  "anyOf": [
    { "required": ["timestamp"] },
    { "required": ["timecode"] }
  ]
}

2.3 SMPTE 정규식 적용

timecode.smpteStart, timecode.smpteEnd 정의를 다음과 같이 교체한다.

{
  "smpteStart": { "$ref": "#/$defs/SMPTETimecode" },
  "smpteEnd":   { "$ref": "#/$defs/SMPTETimecode" }
}

2.4 화면비·해상도 패턴 적용

metadata.deliverySpec.properties.aspectRatio와 resolution을 다음과 같이 교체한다.

{
  "aspectRatio": { "$ref": "#/$defs/AspectRatio" },
  "resolution":  { "$ref": "#/$defs/Resolution" }
}


fps는 23.976 등 비정수 프레임을 위해 number 유지가 타당하다.

2.5 물리 카메라 파라미터 패턴 적용

metadata.cameraSetting.physical.properties를 다음과 같이 교체한다.

{
  "aperture": { "$ref": "#/$defs/Aperture" },
  "shutter":  { "$ref": "#/$defs/Shutter" },
  "iso":      { "type": "integer", "minimum": 25, "maximum": 204800 },
  "ndFilter": { "$ref": "#/$defs/NDFilter" }
}

2.6 무컷 연속성과 페이싱의 연동

스키마 하단 allOf 블록을 아래와 같이 확장한다. noCuts = true이면서 transitionPolicy가 명시되지 않았거나 None인 경우, 시간 왜곡 페이싱을 금지한다. 반대로 Only-internal time ramp인 경우에는 허용한다.

{
  "allOf": [
    {
      "if": {
        "properties": {
          "promptBlueprint": {
            "properties": {
              "metadata": {
                "properties": {
                  "continuity": {
                    "properties": { "noCuts": { "const": true } }
                  }
                },
                "required": ["continuity"]
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
    },
    {
      "if": {
        "properties": {
          "promptBlueprint": {
            "properties": {
              "metadata": {
                "properties": {
                  "continuity": {
                    "properties": {
                      "noCuts": { "const": true },
                      "transitionPolicy": { "enum": ["None"] }
                    }
                  }
                }
              }
            }
          }
        }
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
                        "pacing": {
                          "not": { "enum": ["Time-lapse", "Freeze-frame"] }
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

2.7 UI 힌트 확장성 확보

uiHints에 patternProperties를 추가하여 임의의 JSON Pointer 키를 안전하게 수용하도록 한다. 기존 properties에 둔 기본값 목록은 유지해도 무방하다.

{
  "uiHints": {
    "type": "object",
    "writeOnly": true,
    "patternProperties": {
      "^\\/.*$": {
        "type": "array",
        "items": {
          "oneOf": [
            { "type": "string" },
            { "type": "number" }
          ]
        }
      }
    },
    "additionalProperties": false,
    "properties": {
      "... 기존 기본값 나열부 유지 ..."
    }
  }
}


주의 사항. 기존 스키마의 uiHints.additionalProperties는 임의 키 허용이었으나, 포인터 키만 허용하도록 강화하는 편이 안전하다. 필드명 오탈자 유입을 줄일 수 있다.

3. 서비스 계층 검증 규칙 권고

JSON Schema로 표현하기 어려운 교차 제약은 서비스 계층에서 강제한다.

타임라인 정합성
sequence 엄격 오름차순, 유일성 보장.
timecode.startMs < endMs.
인접 구간의 시간 중복 금지.
마지막 구간의 endMs가 deliverySpec.durationMs와 일치.

연속성 제약 전파
noCuts = true이면 timeline.pacingFX.editingStyle은 컷류 금지.
transitionPolicy = Only-internal time ramp일 때만 Time-lapse, Freeze-frame 허용.

잠금 세그먼트 참조 무결성
lockedSegments는 존재하는 sequence만 포함. 편집 시 해당 항목 불변성 유지.

컬러 그레이드 우선순위
충돌 시 lookDev.grade가 cameraSetting.colorGrade를 우선한다. 서버 저장 시 병합 로직 적용.

요소 식별자 유일성
characters[].id, coreObjects[].id는 각 배열 내 유일해야 하며, 타 엔티티와의 충돌 방지.

컴플라이언스 자동 주입
generationControl.compliance.negativeOverlays의 값은 finalOutput.negativePrompts에 동의어를 포함하여 자동 병합.

4. 회귀 위험 및 호환성 메모

기존 페이로드 중 자유 형식 화면비, 해상도, SMPTE 표기가 새 패턴과 충돌할 수 있다. 마이그레이션 단계에서 표준화 변환 함수를 제공해야 한다.

uiHints.additionalProperties를 false로 강화하는 경우, 과거에 저장된 임의 키는 거부될 수 있다. 읽기 시 허용, 쓰기 시 차단의 점진적 전략을 권한다.

anyOf 추가에 따라 시간 필드가 하나도 없는 타임라인 항목은 거절된다. 에디터에서 저장 전 자동 보정 로직을 제공해야 한다.