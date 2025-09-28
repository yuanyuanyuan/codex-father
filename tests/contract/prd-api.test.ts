/**
 * Contract tests for the PRD REST API described in contracts/prd-api.yaml.
 *
 * These tests express the expected behaviour of every documented endpoint.
 * They intentionally fail today (Red phase of TDD) because the API server has
 * not yet been wired to the contract paths under `/api/v1`. Once the API layer
 * is implemented the tests will pass without modification.
 */

import type { Application } from 'express';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { createAPIServer, type PRDAPIServer } from '../../src/api/server.js';

const API_BASE = '/api/v1';
const AUTH_HEADERS = { Authorization: 'Bearer test-token' };

let app: Application;
let server: PRDAPIServer;
let workspace: string;

// Shared identifiers captured during the test flow
let primaryDraftId = '';
let secondaryDraftId = '';
let storedReviewId = '';
let createdTemplateId = '';

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'prd-api-contract-'));
  server = createAPIServer({
    workingDirectory: workspace,
  });
  app = server.getApp();
});

afterAll(() => {
  if (workspace && existsSync(workspace)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe.sequential('PRD API contract (Red phase)', () => {
  describe('Draft management', () => {
    it('creates a new PRD draft (POST /drafts)', async () => {
      const draftPayload = {
        title: 'Contract Test Draft',
        description: 'Draft created during API contract verification',
        templateId: 'technical-template',
        metadata: {
          tags: ['contract', 'test'],
          priority: 'high',
        },
      };

      const response = await request(app)
        .post(`${API_BASE}/drafts`)
        .set(AUTH_HEADERS)
        .send(draftPayload)
        .expect(201);

      expect(response.body).toMatchObject({
        title: draftPayload.title,
        templateId: draftPayload.templateId,
        metadata: expect.objectContaining({
          priority: draftPayload.metadata.priority,
        }),
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      primaryDraftId = response.body.id;
    });

    it('lists PRD drafts with pagination (GET /drafts)', async () => {
      const response = await request(app)
        .get(`${API_BASE}/drafts`)
        .set(AUTH_HEADERS)
        .query({ page: 1, limit: 20 })
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        pagination: expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      });
    });

    it('retrieves draft details (GET /drafts/{draftId})', async () => {
      const response = await request(app)
        .get(`${API_BASE}/drafts/${primaryDraftId}`)
        .set(AUTH_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        id: primaryDraftId,
        title: expect.any(String),
        metadata: expect.any(Object),
        sections: expect.any(Array),
      });
    });

    it('updates an existing draft (PUT /drafts/{draftId})', async () => {
      const updatePayload = {
        title: 'Contract Test Draft (Updated)',
        metadata: {
          priority: 'medium',
        },
      };

      const response = await request(app)
        .put(`${API_BASE}/drafts/${primaryDraftId}`)
        .set(AUTH_HEADERS)
        .send(updatePayload)
        .expect(200);

      expect(response.body).toMatchObject({
        id: primaryDraftId,
        title: updatePayload.title,
        metadata: expect.objectContaining({
          priority: updatePayload.metadata.priority,
        }),
      });
    });

    it('deletes a draft (DELETE /drafts/{draftId})', async () => {
      const tempDraftResponse = await request(app)
        .post(`${API_BASE}/drafts`)
        .set(AUTH_HEADERS)
        .send({
          title: 'Draft To Delete',
          templateId: 'technical-template',
          metadata: { priority: 'low' },
        })
        .expect(201);

      secondaryDraftId = tempDraftResponse.body.id;

      await request(app)
        .delete(`${API_BASE}/drafts/${secondaryDraftId}`)
        .set(AUTH_HEADERS)
        .expect(204);
    });
  });

  describe('Version management', () => {
    it('lists draft versions (GET /drafts/{draftId}/versions)', async () => {
      const response = await request(app)
        .get(`${API_BASE}/drafts/${primaryDraftId}/versions`)
        .set(AUTH_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
      });
    });

    it('retrieves a draft version (GET /drafts/{draftId}/versions/{version})', async () => {
      const response = await request(app)
        .get(`${API_BASE}/drafts/${primaryDraftId}/versions/1`)
        .set(AUTH_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        draftId: primaryDraftId,
        versionNumber: expect.any(Number),
        metadata: expect.any(Object),
      });
    });

    it('restores a version (POST /drafts/{draftId}/versions/{version})', async () => {
      const response = await request(app)
        .post(`${API_BASE}/drafts/${primaryDraftId}/versions/1`)
        .set(AUTH_HEADERS)
        .send({ commitMessage: 'Restore initial version for contract test' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: primaryDraftId,
        version: expect.any(Number),
      });
    });
  });

  describe('Review workflow', () => {
    it('retrieves review status (GET /drafts/{draftId}/reviews)', async () => {
      const response = await request(app)
        .get(`${API_BASE}/drafts/${primaryDraftId}/reviews`)
        .set(AUTH_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        draftId: primaryDraftId,
        status: expect.any(String),
        reviews: expect.any(Array),
      });
    });

    it('submits draft for review (POST /drafts/{draftId}/reviews)', async () => {
      const response = await request(app)
        .post(`${API_BASE}/drafts/${primaryDraftId}/reviews`)
        .set(AUTH_HEADERS)
        .send({
          reviewers: ['architect-user', 'qa-user'],
          dueDate: '2025-10-05',
          priority: 'high',
          message: 'Please review the architecture changes',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        draftId: primaryDraftId,
        status: expect.any(String),
        reviews: expect.any(Array),
      });

      storedReviewId = response.body.reviews?.[0]?.id ?? 'pending-review-id';
      expect(typeof storedReviewId).toBe('string');
    });

    it('submits review feedback (PUT /drafts/{draftId}/reviews/{reviewId})', async () => {
      const response = await request(app)
        .put(`${API_BASE}/drafts/${primaryDraftId}/reviews/${storedReviewId}`)
        .set(AUTH_HEADERS)
        .send({
          decision: 'approved',
          comments: 'Looks good from architecture perspective.',
          reviewer: 'architect-user',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: storedReviewId,
        decision: 'approved',
      });
    });
  });

  describe('Template catalogue', () => {
    it('lists templates (GET /templates)', async () => {
      const response = await request(app)
        .get(`${API_BASE}/templates`)
        .set(AUTH_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
      });
    });

    it('creates a template (POST /templates)', async () => {
      const templatePayload = {
        name: 'architecture-template-contract',
        description: 'Template defined during API contract validation',
        version: '1.0.0',
        structure: {
          sections: [
            {
              id: 'overview',
              title: 'Project Overview',
              order: 1,
              level: 1,
              isRequired: true,
              editableBy: ['architect'],
            },
          ],
          fields: [],
          rules: [],
          decisionTables: [],
        },
        isDefault: false,
      };

      const response = await request(app)
        .post(`${API_BASE}/templates`)
        .set(AUTH_HEADERS)
        .send(templatePayload)
        .expect(201);

      expect(response.body).toMatchObject({
        name: templatePayload.name,
        description: templatePayload.description,
        version: templatePayload.version,
      });
      expect(response.body).toHaveProperty('id');
      createdTemplateId = response.body.id;
    });

    it('retrieves template details (GET /templates/{templateId})', async () => {
      const response = await request(app)
        .get(`${API_BASE}/templates/${createdTemplateId}`)
        .set(AUTH_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdTemplateId,
        name: expect.any(String),
        structure: expect.any(Object),
      });
    });
  });

  describe('User management', () => {
    it('lists users (GET /users)', async () => {
      const response = await request(app).get(`${API_BASE}/users`).set(AUTH_HEADERS).expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
      });
    });

    it('retrieves current user profile (GET /users/me)', async () => {
      const response = await request(app).get(`${API_BASE}/users/me`).set(AUTH_HEADERS).expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        roles: expect.any(Array),
      });
    });

    it('updates current user profile (PUT /users/me)', async () => {
      const response = await request(app)
        .put(`${API_BASE}/users/me`)
        .set(AUTH_HEADERS)
        .send({
          displayName: 'Contract Tester',
          preferences: {
            language: 'en',
            timezone: 'UTC',
            emailNotifications: true,
          },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        displayName: 'Contract Tester',
        preferences: expect.objectContaining({
          language: 'en',
          timezone: 'UTC',
        }),
      });
    });
  });
});
