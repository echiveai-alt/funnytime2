export const STAGE1_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    jobRequirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: {
            type: "string",
            description: "The requirement text"
          },
          importance: {
            type: "string",
            enum: ["absolute", "critical", "high", "medium", "low"]
          },
          category: {
            type: "string",
            enum: ["education_degree", "education_field", "years_experience", "role_title", "technical_skill", "soft_skill", "domain_knowledge"]
          },
          minimumDegreeLevel: {
            type: "string",
            enum: ["Other", "Diploma", "Associate", "Bachelor's", "Master's", "PhD"],
            description: "Required for education_degree category"
          },
          requiredField: {
            type: "string",
            description: "Required for education_field category"
          },
          fieldCriteria: {
            type: "string",
            description: "Field matching criteria for education_field"
          },
          minimumYears: {
            type: "number",
            description: "Required for years_experience category"
          },
          specificRole: {
            type: "string",
            description: "For years_experience with specific role requirements"
          },
          requiredTitleKeywords: {
            type: "array",
            items: {
              type: "string"
            },
            description: "For role_title category"
          }
        },
        required: ["requirement", "importance", "category"],
        additionalProperties: false
      }
    },
    allKeywords: {
      type: "array",
      items: {
        type: "string"
      }
    },
    jobTitle: {
      type: "string"
    },
    companySummary: {
      type: "string"
    }
  },
  required: ["jobRequirements", "allKeywords", "jobTitle", "companySummary"],
  additionalProperties: false
};

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
      description: "Missing absolute requirements if any (empty array if none)"
    },
    criticalGaps: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Missing critical requirements if any (empty array if none)"
    },
    recommendations: {
      type: "object",
      properties: {
        forCandidate: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Recommendations if score < 80% (empty array if score >= 80%)"
        }
      },
      required: ["forCandidate"],
      additionalProperties: false
    }
  },
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
      patternProperties: {
        "^.*$": {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: {
                type: "string"
              },
              experienceId: {
                type: "string"
              },
              keywordsUsed: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              relevanceScore: {
                type: "number"
              }
            },
            required: ["text", "experienceId", "keywordsUsed", "relevanceScore"]
          }
        }
      }
    },
    keywordsUsed: {
      type: "array",
      items: {
        type: "string"
      }
    },
    keywordsNotUsed: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: ["bulletPoints", "keywordsUsed", "keywordsNotUsed"]
};
