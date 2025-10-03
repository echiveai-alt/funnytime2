export const STAGE2A_MATCHING_SCHEMA = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Overall match score 0-100"
    },
    isFit: {
      type: "boolean",
      description: "Whether candidate is a fit (score >= 80)"
    },
    fitLevel: {
      type: "string",
      enum: ["Excellent", "Good", "Fair", "Poor"],
      description: "Qualitative fit assessment"
    },
    matchedRequirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          jobRequirement: {
            type: "string",
            description: "The requirement text"
          },
          experienceEvidence: {
            type: "string",
            description: "What evidence shows - for experience requirements MUST include calculation with role breakdown"
          },
          experienceSource: {
            type: "string",
            description: "For experience requirements: Role1 at Company1 (Xmo) + Role2 at Company2 (Ymo) = Total ÷ 12 = Y years. For others: source citation"
          }
        },
        required: ["jobRequirement", "experienceEvidence", "experienceSource"],
        additionalProperties: false
      }
    },
    unmatchedRequirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: {
            type: "string"
          },
          importance: {
            type: "string",
            enum: ["absolute", "critical", "high", "medium", "low"]
          }
        },
        required: ["requirement", "importance"],
        additionalProperties: false
      }
    },
    absoluteGaps: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Missing absolute requirements if any"
    },
    criticalGaps: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Missing critical requirements if any"
    },
    recommendations: {
      type: "object",
      properties: {
        forCandidate: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Recommendations if score < 80%"
        }
      },
      required: ["forCandidate"],
      additionalProperties: false
    }
  },
  // ✅ FIX: ALL properties must be in required array for OpenAI Structured Outputs
  required: [
    "overallScore", 
    "isFit", 
    "fitLevel", 
    "matchedRequirements", 
    "unmatchedRequirements",
    "absoluteGaps",
    "criticalGaps", 
    "recommendations"
  ],
  additionalProperties: false
};

export const STAGE2B_BULLETS_SCHEMA = {
  type: "object",
  properties: {
    bulletPoints: {
      type: "object",
      description: "Bullets organized by 'Company - Role' keys. Dynamic keys are allowed.",
      // Remove additionalProperties from here since it conflicts with structured outputs
      patternProperties: {
        "^.*$": {  // Matches any key
          type: "array",
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The bullet point text"
              },
              experienceId: {
                type: "string",
                description: "ID of the experience this bullet is based on"
              },
              keywordsUsed: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "Keywords embedded in this bullet"
              },
              relevanceScore: {
                type: "number",
                description: "Relevance score 1-10"
              }
            },
            required: ["text", "experienceId", "keywordsUsed", "relevanceScore"],
            additionalProperties: false
          }
        }
      }
    },
    keywordsUsed: {
      type: "array",
      items: {
        type: "string"
      },
      description: "All keywords used across bullets"
    },
    keywordsNotUsed: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Keywords that couldn't be naturally embedded"
    }
  },
  required: ["bulletPoints", "keywordsUsed", "keywordsNotUsed"],
  additionalProperties: false
};
