# Model Usage Policy for Property Management Application

## Overview

This document outlines the official policy regarding permitted AI model usage for document processing within our property management application. This policy is in place to ensure consistent, reliable performance and adherence to our security and compliance requirements.

## Permitted Models

### Exclusively Google Gemini Models

The application is configured to **exclusively** use Google Gemini models for all document processing tasks, including:

1. **Gemini Flash 1.5** - Primary model for OCR and document analysis
2. **Gemini 2.0 Pro** - Secondary model used as fallback when necessary

### Enforcement Mechanism

Our system implements a strict enforcement policy to ensure **ONLY** Google Gemini models are used:

1. **Request-Level Enforcement**: 
   - API requests are configured with specific headers (`X-Require-Model`, `X-No-Fallbacks`, `X-Provider-Only`)
   - Route explicitly set to `google/gemini`
   - Model list restricted to approved Gemini models

2. **Response-Level Validation**:
   - All responses are checked to verify they came from an authorized Gemini model
   - Responses are rejected if they come from unauthorized models (even if the request was configured correctly)
   - Security alerts are generated for any attempted use of non-Gemini models

3. **Pattern Recognition**:
   - Additional validation checks look for specific patterns that might indicate a Meta Llama model was used
   - Multiple layers of validation prevent circumvention of model restrictions

## Prohibited Models

The following models are explicitly prohibited and blocked by our system:

1. **Meta's Llama Models** (all versions)
2. Any non-Google large language models
3. Any open-source models not explicitly authorized

## Technical Implementation

The application enforces this policy through multiple layers:

- **Server-side validation** that checks both request configuration and response metadata
- **Client-side detection** of unauthorized model usage
- **Request headers** that instruct the API gateway to strictly enforce model selection
- **No fallbacks** configuration to prevent automatic substitution with non-approved models
- **Response validation** to verify actual model used matches requested model

## Error Handling

When an unauthorized model is detected:

1. The response is immediately rejected
2. A 403 Forbidden status code is returned
3. A security violation alert is logged
4. The client is notified of the policy violation
5. No data from unauthorized models is processed or stored

## Justification

This policy ensures:

1. **Consistent quality** in document processing results
2. **Reliable performance** across all document types
3. **Compliance** with our security requirements
4. **Streamlined testing** and quality assurance processes
5. **Reduced support issues** from inconsistent model behavior

## Version

Policy Version: 2.0.1
Last Updated: February 26, 2025