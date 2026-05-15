import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BoardItem, ConflictThreat, ExtensionMessage, GHLabel, LinkedPR, PRFile, RunwayConfig, RunwayData } from '../src/types';
import { ColumnGroup } from './components/ColumnGroup';
import { DetailPanel } from './components/DetailPanel';
import { LaunchpadView } from './components/LaunchpadView';
import { SettingsPanel } from './components/SettingsPanel';

// Acquire vscode API once (must not be called more than once)
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const vscodeApi = acquireVsCodeApi();

type FilterTab = 'dashboard' | 'all' | 'prs' | 'issues' | 'milestones';

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    background: #13131c;
    color: #cdd6f4;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: hidden;
  }

  #root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* ─── Header ─────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid #2a2a3d;
    flex-shrink: 0;
    background: #13131c;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title {
    font-size: 17px;
    font-weight: 700;
    color: #cdd6f4;
    letter-spacing: -0.3px;
  }

  .project-name {
    font-size: 12px;
    color: #6c7086;
    font-weight: 400;
    margin-left: 4px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .total-badge {
    background: #1e1e2d;
    border: 1px solid #2a2a3d;
    color: #6c7086;
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    background: #1e1e2d;
    color: #a6adc8;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn:hover {
    background: #252535;
    border-color: #89b4fa;
    color: #89b4fa;
  }

  .btn:active {
    transform: scale(0.97);
  }

  .btn.loading svg {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ─── Toolbar ─────────────────────────────── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    border-bottom: 1px solid #2a2a3d;
    flex-shrink: 0;
    background: #13131c;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid transparent;
    color: #585b70;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: #cdd6f4;
    background: #1e1e2d;
  }

  .tab-btn.active {
    color: #cdd6f4;
    background: #1e1e2d;
    border-color: #2a2a3d;
  }

  .tab-count {
    background: #2a2a3d;
    color: #585b70;
    border-radius: 8px;
    padding: 0 6px;
    font-size: 11px;
    min-width: 18px;
    text-align: center;
  }

  .tab-btn.active .tab-count {
    background: #89b4fa;
    color: #13131c;
  }

  .toolbar-sep {
    width: 1px;
    height: 16px;
    background: #2a2a3d;
    margin: 0 4px;
  }

  /* ─── Search ─────────────────────────────── */
  .search-wrap {
    padding: 8px 20px;
    border-bottom: 1px solid #2a2a3d;
    flex-shrink: 0;
    background: #13131c;
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 32px;
    top: 50%;
    transform: translateY(-50%);
    color: #45475a;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 6px 12px 6px 30px;
    background: #1e1e2d;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: #89b4fa;
  }

  .search-input::placeholder {
    color: #45475a;
  }

  /* ─── Content ─────────────────────────────── */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0 16px;
  }

  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: #2a2a3d; border-radius: 3px; }
  .content::-webkit-scrollbar-thumb:hover { background: #3a3a5d; }

  /* ─── Column group ────────────────────────── */
  .col-group { margin-bottom: 2px; }

  .col-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 20px;
    cursor: pointer;
    transition: background 0.1s;
    user-select: none;
  }

  .col-header:hover { background: #1a1a28; }

  .col-chevron {
    color: #45475a;
    transition: transform 0.2s;
    flex-shrink: 0;
    display: flex;
  }

  .col-chevron.open { transform: rotate(90deg); }

  .col-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .col-name {
    font-weight: 600;
    font-size: 13px;
    color: #cdd6f4;
  }

  .col-count {
    background: #1e1e2d;
    border: 1px solid #2a2a3d;
    color: #6c7086;
    border-radius: 8px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
  }

  .col-items { padding: 2px 12px 8px; }

  /* ─── Item card ───────────────────────────── */
  .item-card {
    padding: 10px 12px;
    margin-bottom: 4px;
    background: #1e1e2d;
    border: 1px solid #2a2a3d;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .item-card:hover {
    background: #252535;
    border-color: #3d3d58;
  }

  .item-top {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .item-type {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .item-body { flex: 1; min-width: 0; }

  .item-title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .item-title {
    font-weight: 500;
    color: #cdd6f4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .item-title:hover { text-decoration: underline; color: #89b4fa; }

  .item-num {
    color: #585b70;
    font-size: 12px;
    flex-shrink: 0;
  }

  .item-bottom {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 5px;
    flex-wrap: wrap;
  }

  /* Labels */
  .label {
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  /* Meta row */
  .item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .repo-tag {
    display: flex;
    align-items: center;
    gap: 3px;
    color: #45475a;
    font-size: 11px;
    white-space: nowrap;
  }

  .branch-tag {
    display: flex;
    align-items: center;
    gap: 3px;
    color: #585b70;
    font-size: 11px;
    white-space: nowrap;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .diff-stats {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .diff-add { color: #a6e3a1; }
  .diff-del { color: #f38ba8; }

  /* Avatars */
  .avatar-group { display: flex; }

  .avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid #1e1e2d;
    overflow: hidden;
    margin-left: -4px;
    flex-shrink: 0;
    background: #2a2a3d;
  }

  .avatar:first-child { margin-left: 0; }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: #45475a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #cdd6f4;
    font-weight: 700;
  }

  /* CI / Review status */
  .ci-icon { display: flex; align-items: center; }
  .ci-success { color: #a6e3a1; }
  .ci-failure { color: #f38ba8; }
  .ci-pending { color: #f9e2af; }
  .ci-none    { color: #45475a; }

  .review-icons { display: flex; align-items: center; gap: 2px; }
  .review-approved { color: #a6e3a1; }
  .review-changes  { color: #f38ba8; }
  .review-pending  { color: #f9e2af; }

  .draft-badge {
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid #45475a;
    color: #585b70;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ─── States ──────────────────────────────── */
  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 14px;
    padding: 40px;
    text-align: center;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #2a2a3d;
    border-top-color: #89b4fa;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }

  .state-title { color: #a6adc8; font-size: 14px; font-weight: 600; }
  .state-sub   { color: #6c7086; font-size: 12px; line-height: 1.6; }
  .state-err   { color: #f38ba8; }

  .empty-group {
    padding: 16px 20px;
    color: #45475a;
    font-size: 12px;
    font-style: italic;
  }

  /* ─── Footer ──────────────────────────────── */
  .footer {
    padding: 5px 20px;
    font-size: 11px;
    color: #45475a;
    border-top: 1px solid #1e1e2d;
    flex-shrink: 0;
    background: #13131c;
  }

  /* ─── Sprint select ───────────────────────── */
  .sprint-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 16px;
    border-bottom: 1px solid #2a2a3d;
    flex-shrink: 0;
    background: #13131c;
  }

  .sprint-label {
    font-size: 11px;
    color: #45475a;
    white-space: nowrap;
    flex-shrink: 0;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sprint-select {
    flex: 1;
    max-width: 220px;
    padding: 3px 8px;
    background: #1e1e2d;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    color: #a6adc8;
    font-size: 12px;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2345475a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    padding-right: 24px;
  }

  .sprint-select:focus { border-color: #89b4fa; }

  .sprint-select option { background: #1e1e2d; color: #cdd6f4; }

  .sprint-active-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #89b4fa;
    background: #89b4fa18;
    border: 1px solid #89b4fa44;
    padding: 2px 8px;
    border-radius: 8px;
    white-space: nowrap;
  }

  .sprint-clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: #89b4fa33;
    color: #89b4fa;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
    padding: 0;
    transition: background 0.15s;
  }

  .sprint-clear-btn:hover { background: #89b4fa55; }

  /* ─── Card github link ────────────────────── */
  .card-gh-link {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 2px 4px;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: #45475a;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }

  .item-card:hover .card-gh-link {
    opacity: 1;
  }

  .card-gh-link:hover {
    color: #89b4fa !important;
  }

  /* ─── Detail panel ────────────────────────── */
  .detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(6px) saturate(160%);
    -webkit-backdrop-filter: blur(6px) saturate(160%);
    z-index: 200;
    display: flex;
    justify-content: flex-end;
  }

  .detail-panel {
    width: 520px;
    max-width: 90vw;
    height: 100%;
    background: #16162a;
    border-left: 1px solid #2a2a3d;
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.2s ease;
    box-shadow: -8px 0 40px rgba(0,0,0,0.4);
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);   opacity: 1; }
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #2a2a3d;
    flex-shrink: 0;
    gap: 8px;
  }

  .detail-header-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .detail-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .detail-type-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid;
  }

  .detail-num {
    font-size: 12px;
    color: #585b70;
  }

  .detail-gh-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    background: #1e1e2d;
    color: #a6adc8;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .detail-gh-btn:hover {
    border-color: #89b4fa;
    color: #89b4fa;
    background: #89b4fa11;
  }

  .detail-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid #2a2a3d;
    background: transparent;
    color: #585b70;
    cursor: pointer;
    transition: all 0.15s;
  }

  .detail-close-btn:hover {
    background: #1e1e2d;
    color: #f38ba8;
    border-color: #f38ba855;
  }

  .detail-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .detail-scroll::-webkit-scrollbar { width: 5px; }
  .detail-scroll::-webkit-scrollbar-track { background: transparent; }
  .detail-scroll::-webkit-scrollbar-thumb { background: #2a2a3d; border-radius: 3px; }

  .detail-title {
    font-size: 15px;
    font-weight: 600;
    color: #cdd6f4;
    line-height: 1.4;
    margin-bottom: 10px;
  }

  .detail-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .badge-sprint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #89b4fa;
    background: #89b4fa18;
    border: 1px solid #89b4fa44;
    padding: 2px 8px;
    border-radius: 8px;
  }

  .badge-milestone {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #cba6f7;
    background: #cba6f718;
    border: 1px solid #cba6f744;
    padding: 2px 8px;
    border-radius: 8px;
  }

  .detail-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 10px;
  }

  .detail-pr-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .detail-ci-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid;
  }

  .detail-branch {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #585b70;
    background: #1e1e2d;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid #2a2a3d;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-reviews {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }

  .detail-review-chip {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 8px;
  }

  .review-approved-chip { background: #a6e3a122; color: #a6e3a1; border: 1px solid #a6e3a144; }
  .review-changes-chip  { background: #f38ba822; color: #f38ba8; border: 1px solid #f38ba844; }
  .review-pending-chip  { background: #f9e2af22; color: #f9e2af; border: 1px solid #f9e2af44; }

  .detail-divider {
    height: 1px;
    background: #2a2a3d;
    margin: 12px 0;
  }

  .detail-section { margin-bottom: 4px; }

  .detail-section-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #45475a;
    margin-bottom: 6px;
  }

  .detail-body-text {
    font-family: inherit;
    font-size: 12px;
    line-height: 1.6;
    color: #a6adc8;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 280px;
    overflow-y: auto;
    background: #1e1e2d;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    padding: 10px;
  }

  .detail-body-empty {
    font-size: 12px;
    color: #45475a;
    font-style: italic;
  }

  .detail-meta-grid { display: flex; flex-direction: column; gap: 8px; }

  .detail-meta-row {
    display: flex;
    gap: 10px;
  }

  .detail-meta-label {
    font-size: 11px;
    color: #45475a;
    min-width: 80px;
    flex-shrink: 0;
    padding-top: 1px;
  }

  .detail-meta-value {
    font-size: 12px;
    color: #a6adc8;
    flex: 1;
    min-width: 0;
  }

  .detail-meta-user {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .detail-avatar {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  /* ─── Linked PRs / CI checks ─────────────── */
  .detail-linked-prs { display: flex; flex-direction: column; gap: 10px; }

  .linked-pr-card {
    background: #13131c;
    border: 1px solid #2a2a3d;
    border-radius: 8px;
    overflow: hidden;
  }

  .linked-pr-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid #2a2a3d;
    cursor: pointer;
  }

  .linked-pr-header:hover { background: #1e1e2d; }

  .linked-pr-num {
    font-size: 11px;
    color: #585b70;
    flex-shrink: 0;
  }

  .linked-pr-title {
    font-size: 12px;
    color: #a6adc8;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ci-icon {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ci-icon-success { background: #a6e3a1; box-shadow: 0 0 4px #a6e3a166; }
  .ci-icon-failure { background: #f38ba8; box-shadow: 0 0 4px #f38ba866; }
  .ci-icon-pending { background: #f9e2af; }
  .ci-icon-neutral { background: #585b70; }

  .check-runs-list {
    display: flex;
    flex-direction: column;
  }

  .check-run-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border-top: 1px solid #1e1e2d;
    transition: background 0.12s;
    text-decoration: none;
    cursor: default;
  }

  .check-run-row[href] { cursor: pointer; }
  .check-run-row[href]:hover { background: #1e1e2d; }

  .check-run-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .check-run-name {
    font-size: 11px;
    color: #a6adc8;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .check-run-status {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  .check-run-link-icon {
    opacity: 0;
    flex-shrink: 0;
    transition: opacity 0.12s;
    color: #45475a;
  }

  .check-run-row[href]:hover .check-run-link-icon { opacity: 1; }

  /* ─── Settings modal ──────────────────────── */
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .settings-modal {
    background: #1a1a2e;
    border: 1px solid #2a2a3d;
    border-radius: 12px;
    width: 380px;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    animation: fadeScaleIn 0.18s ease;
    box-shadow: 0 24px 48px rgba(0,0,0,0.4);
  }

  @keyframes fadeScaleIn {
    from { opacity: 0; transform: scale(0.94); }
    to   { opacity: 1; transform: scale(1); }
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #2a2a3d;
  }

  .settings-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #cdd6f4;
  }

  .settings-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .settings-field { display: flex; flex-direction: column; gap: 5px; }

  .settings-label {
    font-size: 11px;
    font-weight: 600;
    color: #a6adc8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .settings-input {
    width: 100%;
    padding: 7px 10px;
    background: #13131c;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  .settings-input:focus { border-color: #89b4fa; }

  .settings-input-sm { max-width: 100px; }

  .settings-hint {
    font-size: 11px;
    color: #45475a;
    line-height: 1.4;
  }

  .settings-hint strong { color: #89b4fa; }
  .settings-hint em { color: #6c7086; font-style: normal; }

  .settings-toggle-group {
    display: flex;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    overflow: hidden;
  }

  .settings-toggle-btn {
    flex: 1;
    padding: 6px;
    background: transparent;
    border: none;
    color: #585b70;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .settings-toggle-btn:not(:last-child) { border-right: 1px solid #2a2a3d; }

  .settings-toggle-btn.active {
    background: #89b4fa22;
    color: #89b4fa;
  }

  .settings-toggle-btn:hover:not(.active) {
    background: #1e1e2d;
    color: #cdd6f4;
  }

  .settings-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #2a2a3d;
  }

  .btn-primary {
    background: #89b4fa22;
    border-color: #89b4fa;
    color: #89b4fa;
  }

  .btn-primary:hover {
    background: #89b4fa33 !important;
    border-color: #89b4fa !important;
    color: #89b4fa !important;
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ─── Milestones view ─────────────────────── */
  .milestone-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    color: #45475a;
    font-size: 13px;
    text-align: center;
  }

  /* ─── Launchpad view ──────────────────────── */
  .lp-wrap {
    padding: 8px 12px 16px;
    overflow-x: auto;
    min-width: 0;
  }

  .lp-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 10px;
    flex-wrap: wrap;
  }

  .lp-count {
    font-size: 11px;
    color: #6c7086;
    flex: 1;
  }

  .lp-filter-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #2a2a3d;
    background: transparent;
    color: #6c7086;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .lp-filter-btn:hover {
    background: #1e1e2d;
    color: #cdd6f4;
    border-color: #45475a;
  }
  .lp-filter-btn.active {
    background: rgba(137,180,250,0.15);
    color: #89b4fa;
    border-color: rgba(137,180,250,0.4);
  }
  .light-theme .lp-filter-btn {
    border-color: #bcc0cc;
    color: #6c6f85;
  }
  .light-theme .lp-filter-btn:hover {
    background: #ccd0da;
    color: #4c4f69;
  }
  .light-theme .lp-filter-btn.active {
    background: rgba(30,102,245,0.12);
    color: #1e66f5;
    border-color: rgba(30,102,245,0.4);
  }
  .light-theme .lp-count { color: #8c8fa1; }

  .lp-header-row {
    display: grid;
    grid-template-columns: 36px 52px 1fr 80px 30px 80px 140px;
    gap: 4px;
    align-items: center;
    padding: 0 0 6px;
    border-bottom: 1px solid #2a2a3d;
    color: #45475a;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Clip header label text so it doesn't overflow into the next column */
  .lp-col-age, .lp-col-status, .lp-col-title,
  .lp-col-diff, .lp-col-author, .lp-col-collabs, .lp-col-branch {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: clip;
    min-width: 0;
  }
  .lp-col-age { text-align: right; }

  .lp-group {
    border: 1px solid #2a2a3d;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .lp-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    cursor: pointer;
    user-select: none;
    background: rgba(255,255,255,0.015);
    border-bottom: 1px solid #1e1e2e;
  }

  .lp-group-header:hover {
    background: rgba(255,255,255,0.03);
  }

  .lp-group-icon {
    font-size: 12px;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .lp-group-name {
    font-size: 12px;
    font-weight: 600;
    flex: 1;
  }

  .lp-group-rows {}

  .lp-row {
    display: grid;
    grid-template-columns: 36px 52px 1fr 80px 30px 80px 140px;
    gap: 4px;
    align-items: center;
    padding: 5px 12px;
    border-bottom: 1px solid #1a1a2e;
    cursor: pointer;
    transition: background 0.12s;
    min-height: 34px;
  }

  .lp-row:hover {
    background: rgba(137,180,250,0.06);
  }

  .lp-row:last-child {
    border-bottom: none;
  }

  .lp-age {
    font-size: 11px;
    color: #6c7086;
    text-align: right;
    white-space: nowrap;
  }

  .lp-status-icons {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .lp-branch-icon {
    color: #585b70;
    flex-shrink: 0;
  }

  .lp-ci-dot, .lp-review-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }

  .lp-ci-neutral  { background: #45475a; }
  .lp-ci-success  { background: #a6e3a1; }
  .lp-ci-fail     { background: #f38ba8; }
  .lp-ci-pending  { background: #f9e2af; }

  .lp-review-none     { background: #45475a; }
  .lp-review-approved { background: #a6e3a1; }
  .lp-review-changes  { background: #f38ba8; }
  .lp-review-commented{ background: #89dceb; }

  .lp-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }

  .lp-draft-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(88,91,112,0.35);
    color: #9399b2;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .lp-title {
    font-size: 12px;
    color: #cdd6f4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .lp-num {
    font-size: 10px;
    color: #45475a;
    background: none;
    border: none;
    cursor: pointer;
    padding: 1px 3px;
    border-radius: 3px;
    flex-shrink: 0;
    white-space: nowrap;
    transition: color 0.12s, background 0.12s;
  }

  .lp-num:hover {
    color: #89b4fa;
    background: rgba(137,180,250,0.1);
  }

  .lp-diff {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }

  .lp-add { color: #a6e3a1; }
  .lp-del { color: #f38ba8; }

  .lp-avatars {
    display: flex;
    align-items: center;
    gap: -2px;
  }

  .lp-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid #1e1e2e;
    margin-left: -4px;
    object-fit: cover;
  }

  .lp-avatars:first-of-type .lp-avatar:first-child {
    margin-left: 0;
  }

  .lp-branch {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    overflow: hidden;
  }

  .lp-repo {
    font-size: 10px;
    color: #585b70;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lp-branch-name {
    font-size: 10px;
    color: #45475a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    color: #45475a;
    font-size: 13px;
  }

  /* ── Phase 1: PR Files ───────────────────────── */
  .pr-files-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 4px;
  }
  .pr-file-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .pr-file-row:hover { background: #1e1e2d; }
  .pr-file-status {
    font-size: 10px;
    font-weight: 700;
    width: 12px;
    flex-shrink: 0;
    text-align: center;
  }
  .pr-file-name {
    font-size: 11px;
    color: #cdd6f4;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
  .pr-file-diff {
    display: flex;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .pr-files-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    padding: 4px 8px;
    background: none;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    color: #6c7086;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    justify-content: center;
  }
  .pr-files-toggle:hover {
    background: #1e1e2d;
    color: #89b4fa;
    border-color: #89b4fa55;
  }

  /* ── v2: PR file search + CODEOWNERS ────────── */
  .pr-files-search {
    width: 100%;
    padding: 4px 8px 4px 26px;
    background: #1a1a2e;
    border: 1px solid #2a2a3d;
    border-radius: 5px;
    color: #cdd6f4;
    font-size: 11px;
    outline: none;
    transition: border-color 0.15s;
  }
  .pr-files-search:focus { border-color: #89b4fa; }
  .pr-files-search::placeholder { color: #45475a; }
  .pr-file-owner {
    font-size: 10px;
    color: #6c7086;
    background: #1a1a2e;
    border: 1px solid #2a2a3d;
    border-radius: 4px;
    padding: 1px 5px;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── v2: Branch copy button ──────────────────── */
  .branch-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #45475a;
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .branch-copy-btn:hover { color: #89b4fa; }

  /* ── v2: Merge button + dropdown ─────────────── */
  .detail-merge-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid #a6e3a1;
    border-radius: 6px;
    background: rgba(166, 227, 161, 0.1);
    color: #a6e3a1;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .detail-merge-btn:hover { background: rgba(166, 227, 161, 0.2); }
  .merge-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: #1a1a2e;
    border: 1px solid #2a2a3d;
    border-radius: 8px;
    min-width: 220px;
    z-index: 200;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    overflow: hidden;
  }
  .merge-dropdown-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid #2a2a3d;
  }
  .merge-dropdown-item:last-child { border-bottom: none; }
  .merge-dropdown-item:hover { background: #252535; }
  .merge-dropdown-label { font-size: 12px; font-weight: 500; color: #cdd6f4; }
  .merge-dropdown-desc { font-size: 11px; color: #585b70; }

  /* ── Phase 1: Work-On-This button ────────────── */
  .detail-work-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid #a6e3a1;
    border-radius: 6px;
    background: rgba(166, 227, 161, 0.1);
    color: #a6e3a1;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .detail-work-btn:hover { background: rgba(166, 227, 161, 0.2); }

  /* ── Phase 2: Conflict Threats Banner ────────── */
  .conflict-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(243, 139, 168, 0.08);
    border-bottom: 1px solid rgba(243, 139, 168, 0.3);
    flex-shrink: 0;
  }
  .conflict-banner-icon { color: #f38ba8; flex-shrink: 0; margin-top: 1px; }
  .conflict-banner-body { flex: 1; min-width: 0; }
  .conflict-banner-title { font-size: 12px; font-weight: 600; color: #f38ba8; margin-bottom: 3px; }
  .conflict-banner-items { display: flex; flex-direction: column; gap: 2px; }
  .conflict-banner-item { font-size: 11px; color: #a6adc8; }
  .conflict-banner-item strong { color: #cdd6f4; font-family: monospace; }
  .conflict-banner-dismiss {
    background: none; border: none; color: #585b70; cursor: pointer;
    font-size: 16px; line-height: 1; padding: 0 2px; flex-shrink: 0;
  }
  .conflict-banner-dismiss:hover { color: #cdd6f4; }

  /* ── Phase 3: Standup Modal ──────────────────── */
  .standup-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(14px) saturate(180%);
    -webkit-backdrop-filter: blur(14px) saturate(180%);
    z-index: 400; display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .standup-modal {
    background: #18182c;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    width: 580px; max-width: 100%; max-height: 80vh; display: flex; flex-direction: column;
    animation: fadeScaleIn 0.18s ease;
    box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .standup-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid #2a2a3d;
  }
  .standup-title { font-size: 13px; font-weight: 600; color: #cdd6f4; display: flex; align-items: center; gap: 8px; }
  .standup-body { flex: 1; overflow-y: auto; padding: 16px; }
  .standup-md {
    font-size: 12px; color: #cdd6f4; white-space: pre-wrap; line-height: 1.7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .standup-footer {
    display: flex; align-items: center; justify-content: flex-end;
    gap: 8px; padding: 12px 16px; border-top: 1px solid #2a2a3d;
  }

  /* View toggle pill */
  .standup-view-toggle {
    display: flex;
    border: 1px solid #2a2a3d;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .standup-view-btn {
    display: inline-flex;
    align-items: center;
    line-height: 1;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 500;
    background: transparent;
    border: none;
    color: #585b70;
    cursor: pointer;
    transition: all 0.15s;
    height: 28px;
  }
  .standup-view-btn:not(:last-child) { border-right: 1px solid #2a2a3d; }
  .standup-view-btn.active { background: #89b4fa22; color: #89b4fa; }
  .standup-view-btn:hover:not(.active) { background: #1e1e2d; color: #cdd6f4; }

  /* Rendered markdown styles */
  .standup-rendered { line-height: 1.65; }
  .standup-h2 {
    font-size: 14px; font-weight: 700; color: #cdd6f4;
    margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #2a2a3d;
  }
  .standup-h3 {
    font-size: 12px; font-weight: 600; color: #a6adc8;
    margin: 12px 0 6px;
  }
  .standup-li {
    display: flex; gap: 8px; align-items: baseline;
    font-size: 12px; color: #cdd6f4; margin-bottom: 4px;
  }
  .standup-bullet { color: #585b70; flex-shrink: 0; font-size: 14px; line-height: 1.3; }
  .standup-p { font-size: 12px; color: #6c7086; margin: 6px 0; }
  .standup-em { color: #6c7086; font-style: italic; }
  .standup-link {
    color: #89b4fa; text-decoration: none; font-weight: 500;
  }
  .standup-link:hover { text-decoration: underline; }
  .standup-spacer { height: 10px; }

  /* ── Phase 3: Metadata Editor ────────────────── */
  .metadata-editor { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .metadata-editor-row { display: flex; align-items: flex-start; gap: 10px; }
  .metadata-editor-label {
    font-size: 11px; color: #6c7086; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.4px; padding-top: 3px; min-width: 52px; flex-shrink: 0;
  }
  .metadata-editor-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 1; }
  .metadata-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 6px; border-radius: 10px; }
  .metadata-tag-remove {
    background: none; border: none; color: inherit; opacity: 0.6;
    cursor: pointer; padding: 0; font-size: 13px; line-height: 1; display: flex; align-items: center;
  }
  .metadata-tag-remove:hover { opacity: 1; }
  .metadata-add-btn {
    background: #1e1e2d; border: 1px dashed #3a3a5d; color: #6c7086; border-radius: 10px;
    width: 22px; height: 22px; cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center; transition: all 0.12s; padding: 0;
  }
  .metadata-add-btn:hover { border-color: #89b4fa; color: #89b4fa; }
  .metadata-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; background: #1a1a2e;
    border: 1px solid #2a2a3d; border-radius: 8px; min-width: 160px; max-height: 200px;
    overflow-y: auto; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .metadata-dropdown-item {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px;
    background: none; border: none; color: #cdd6f4; font-size: 12px; cursor: pointer; text-align: left; transition: background 0.1s;
  }
  .metadata-dropdown-item:hover { background: #252535; }

  /* ── Settings switch toggle ── */
  .settings-field-row {
    flex-direction: row !important;
    align-items: center;
    justify-content: space-between;
  }
  .settings-toggle-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #cdd6f4;
  }
  .settings-toggle-icon { font-size: 14px; color: #89b4fa; }
  .settings-switch {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: #313244;
    border: 1px solid #45475a;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;
    padding: 0;
  }
  .settings-switch.active {
    background: #89b4fa;
    border-color: #89b4fa;
  }
  .settings-switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #cdd6f4;
    transition: transform 0.2s;
  }
  .settings-switch.active .settings-switch-knob {
    transform: translateX(16px);
    background: #13131c;
  }

  /* ═══════════════════════════════════════════
     Liquid Glass theme — deep refractive glass
     ═══════════════════════════════════════════ */
  body.liquid-glass,
  #root.liquid-glass {
    background: radial-gradient(ellipse at 20% 50%, #0d0d22 0%, #06060f 60%, #0a0814 100%);
  }

  /* Chrome bars */
  .liquid-glass .header,
  .liquid-glass .toolbar {
    background: rgba(6, 6, 16, 0.52) !important;
    backdrop-filter: blur(64px) saturate(240%) brightness(0.9);
    -webkit-backdrop-filter: blur(64px) saturate(240%) brightness(0.9);
    border-bottom: 1px solid rgba(255,255,255,0.07) !important;
    box-shadow: 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4);
  }

  /* Board column groups */
  .liquid-glass .col-group {
    background: rgba(14, 14, 28, 0.32);
    backdrop-filter: blur(52px) saturate(220%);
    -webkit-backdrop-filter: blur(52px) saturate(220%);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      0 16px 56px rgba(0,0,0,0.38),
      inset 0 1px 0 rgba(255,255,255,0.12),
      inset 0 -1px 0 rgba(0,0,0,0.18);
    position: relative;
    overflow: hidden;
  }
  .liquid-glass .col-group::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      148deg,
      rgba(255,255,255,0.07) 0%,
      rgba(137,180,250,0.04) 35%,
      rgba(203,166,247,0.03) 70%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 0;
  }
  .liquid-glass .col-group > * { position: relative; z-index: 1; }

  /* Board item cards */
  .liquid-glass .item-card {
    background: rgba(22, 22, 44, 0.26);
    backdrop-filter: blur(36px) saturate(200%);
    -webkit-backdrop-filter: blur(36px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      0 4px 20px rgba(0,0,0,0.22),
      inset 0 1px 0 rgba(255,255,255,0.1);
    position: relative;
    overflow: hidden;
  }
  /* Top specular highlight on each card */
  .liquid-glass .item-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22) 50%, transparent);
    pointer-events: none;
  }
  .liquid-glass .item-card:hover {
    background: rgba(46, 50, 82, 0.44);
    border-color: rgba(137,180,250,0.32);
    box-shadow:
      0 8px 36px rgba(0,0,0,0.32),
      0 0 0 1px rgba(137,180,250,0.14),
      inset 0 1px 0 rgba(255,255,255,0.14);
  }

  /* Dashboard PR groups */
  .liquid-glass .lp-group {
    background: rgba(14, 14, 28, 0.32);
    backdrop-filter: blur(48px) saturate(220%);
    -webkit-backdrop-filter: blur(48px) saturate(220%);
    border: 1px solid rgba(255,255,255,0.09);
    box-shadow:
      0 12px 52px rgba(0,0,0,0.32),
      inset 0 1px 0 rgba(255,255,255,0.12);
    border-radius: 12px;
    margin-bottom: 8px;
    position: relative;
    overflow: hidden;
  }
  .liquid-glass .lp-group::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      155deg,
      rgba(255,255,255,0.06) 0%,
      rgba(137,180,250,0.03) 40%,
      transparent 55%
    );
    pointer-events: none;
    border-radius: inherit;
    z-index: 0;
  }
  .liquid-glass .lp-group > * { position: relative; z-index: 1; }
  .liquid-glass .lp-row:hover { background: rgba(137,180,250,0.09); }
  .liquid-glass .lp-group-header {
    background: rgba(255,255,255,0.025);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  /* Detail side panel */
  .liquid-glass .detail-overlay {
    backdrop-filter: blur(20px) saturate(200%) brightness(0.8) !important;
    -webkit-backdrop-filter: blur(20px) saturate(200%) brightness(0.8) !important;
    background: rgba(0,0,0,0.12) !important;
  }
  .liquid-glass .detail-panel {
    background: rgba(6, 6, 18, 0.58) !important;
    backdrop-filter: blur(80px) saturate(240%) brightness(0.85) !important;
    -webkit-backdrop-filter: blur(80px) saturate(240%) brightness(0.85) !important;
    border-left: 1px solid rgba(255,255,255,0.12) !important;
    box-shadow:
      -16px 0 80px rgba(0,0,0,0.55),
      inset 1px 0 0 rgba(255,255,255,0.06) !important;
  }

  /* Standup modal */
  .liquid-glass .standup-overlay {
    backdrop-filter: blur(28px) saturate(220%) brightness(0.75) !important;
    -webkit-backdrop-filter: blur(28px) saturate(220%) brightness(0.75) !important;
    background: rgba(0,0,0,0.15) !important;
  }
  .liquid-glass .standup-modal {
    background: rgba(8, 8, 20, 0.62) !important;
    backdrop-filter: blur(80px) saturate(240%);
    -webkit-backdrop-filter: blur(80px) saturate(240%);
    border: 1px solid rgba(255,255,255,0.13) !important;
    box-shadow:
      0 40px 100px rgba(0,0,0,0.65),
      0 0 0 1px rgba(255,255,255,0.05),
      inset 0 1px 0 rgba(255,255,255,0.14) !important;
  }

  /* Settings modal */
  .liquid-glass .settings-modal {
    background: rgba(8, 8, 20, 0.68) !important;
    backdrop-filter: blur(80px) saturate(240%);
    -webkit-backdrop-filter: blur(80px) saturate(240%);
    border: 1px solid rgba(255,255,255,0.13) !important;
    box-shadow:
      0 40px 100px rgba(0,0,0,0.65),
      0 0 0 1px rgba(255,255,255,0.05),
      inset 0 1px 0 rgba(255,255,255,0.14) !important;
  }

  /* Inputs, selects */
  .liquid-glass .sprint-select,
  .liquid-glass .search-input {
    background: rgba(20, 20, 40, 0.4);
    backdrop-filter: blur(28px) saturate(200%);
    -webkit-backdrop-filter: blur(28px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.11);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 12px rgba(0,0,0,0.22);
  }

  /* Active tab */
  .liquid-glass .tab-btn.active {
    background: rgba(137,180,250,0.18);
    backdrop-filter: blur(24px) saturate(200%);
    -webkit-backdrop-filter: blur(24px) saturate(200%);
    box-shadow:
      0 0 20px rgba(137,180,250,0.22),
      inset 0 1px 0 rgba(255,255,255,0.14);
    border-color: rgba(137,180,250,0.3);
  }

  /* Misc */
  .liquid-glass .col-group-header { background: transparent; }
  .liquid-glass .footer {
    background: rgba(6, 6, 16, 0.52) !important;
    backdrop-filter: blur(48px) saturate(220%);
    -webkit-backdrop-filter: blur(48px) saturate(220%);
    border-top: 1px solid rgba(255,255,255,0.07) !important;
  }

  /* ── Light Theme (Catppuccin Latte) ── */
  body.light-theme {
    background: #eff1f5;
    color: #4c4f69;
  }
  .light-theme .header {
    background: #e6e9ef !important;
    border-bottom-color: #bcc0cc !important;
  }
  .light-theme .header-title { color: #4c4f69; }
  .light-theme .project-name { color: #8c8fa1; }
  .light-theme .total-badge { background: #ccd0da; border-color: #bcc0cc; color: #5c5f77; }
  .light-theme .icon-btn { color: #6c6f85; }
  .light-theme .icon-btn:hover { background: #ccd0da; color: #4c4f69; }
  .light-theme .toolbar {
    background: #e6e9ef !important;
    border-bottom-color: #bcc0cc !important;
  }
  .light-theme .sprint-bar {
    background: #e6e9ef !important;
    border-bottom-color: #bcc0cc !important;
  }
  .light-theme .sprint-label { color: #6c6f85; }
  .light-theme .tab-btn { color: #6c6f85; }
  .light-theme .tab-btn:hover { background: #ccd0da; color: #4c4f69; }
  .light-theme .tab-btn.active { background: #1e66f5; color: #eff1f5; }
  .light-theme .sprint-select,
  .light-theme .search-input {
    background: #eff1f5 !important;
    border-color: #bcc0cc !important;
    color: #4c4f69 !important;
  }
  .light-theme .sprint-select option { background: #eff1f5; color: #4c4f69; }
  .light-theme .col-group {
    background: #e6e9ef;
    border: 1px solid #bcc0cc;
    box-shadow: 0 1px 4px rgba(76,79,105,0.06);
  }
  .light-theme .col-group-header {
    background: #e6e9ef !important;
    border-bottom-color: #bcc0cc !important;
    color: #4c4f69;
  }
  .light-theme .col-header-title { color: #4c4f69; }
  .light-theme .col-header-count {
    background: #ccd0da;
    color: #5c5f77;
  }
  .light-theme .board-scroll { background: #dce0e8; }
  .light-theme .item-card {
    background: #eff1f5 !important;
    border-color: #bcc0cc !important;
    box-shadow: 0 1px 3px rgba(76,79,105,0.07);
  }
  .light-theme .item-card:hover { background: #e6e9ef !important; border-color: #1e66f5 !important; }
  .light-theme .item-title { color: #4c4f69; }
  .light-theme .item-meta { color: #6c6f85; }
  .light-theme .item-label { background: #ccd0da; color: #4c4f69; border-color: #bcc0cc; }
  .light-theme .footer {
    background: #e6e9ef !important;
    border-top-color: #bcc0cc !important;
    color: #6c6f85;
  }
  .light-theme .lp-group {
    background: #e6e9ef;
    border: 1px solid #bcc0cc;
    box-shadow: 0 1px 4px rgba(76,79,105,0.06);
    border-radius: 10px;
  }
  .light-theme .lp-group-header {
    background: #e6e9ef;
    color: #4c4f69;
    border-bottom-color: #bcc0cc;
  }
  .light-theme .lp-row { border-bottom-color: #bcc0cc; color: #4c4f69; }
  .light-theme .lp-row:hover { background: #ccd0da; }
  .light-theme .lp-pr-title { color: #4c4f69; }
  .light-theme .lp-pr-meta { color: #6c6f85; }
  .light-theme .lp-ci-neutral { background: #acb0be; }
  .light-theme .lp-review-none { background: #acb0be; }
  .light-theme .detail-panel {
    background: #e6e9ef !important;
    border-left-color: #bcc0cc !important;
    color: #4c4f69;
  }
  .light-theme .detail-title { color: #4c4f69; }
  .light-theme .detail-meta-row { color: #6c6f85; }
  .light-theme .detail-section-title { color: #4c4f69; border-bottom-color: #bcc0cc; }
  .light-theme .detail-close-btn { color: #6c6f85; }
  .light-theme .detail-close-btn:hover { background: #ccd0da; }
  .light-theme .detail-body-raw { background: #dce0e8; border-color: #bcc0cc; color: #5c5f77; }
  .light-theme .ci-row { border-bottom-color: #bcc0cc; }
  .light-theme .ci-name { color: #4c4f69; }
  .light-theme .review-chip { background: #ccd0da; color: #4c4f69; }
  .light-theme .pr-meta-row { border-top-color: #bcc0cc; }
  .light-theme .diff-stat { color: #6c6f85; }
  .light-theme .pr-section-title { color: #4c4f69; border-bottom-color: #bcc0cc; }
  .light-theme .review-approved { color: #40a02b; }
  .light-theme .review-changes  { color: #d20f39; }
  .light-theme .ci-success { color: #40a02b; }
  .light-theme .ci-failure { color: #d20f39; }
  .light-theme .ci-icon-success { background: #40a02b; box-shadow: 0 0 4px #40a02b66; }
  .light-theme .ci-icon-failure { background: #d20f39; box-shadow: 0 0 4px #d20f3966; }
  .light-theme .ci-icon-pending { background: #df8e1d; }
  .light-theme .lp-ci-success { background: #40a02b; }
  .light-theme .lp-ci-fail    { background: #d20f39; }
  .light-theme .lp-ci-pending { background: #df8e1d; }
  .light-theme .lp-review-approved { background: #40a02b; }
  .light-theme .lp-review-changes  { background: #d20f39; }
  .light-theme .review-approved-chip { background: #40a02b22; color: #40a02b; border: 1px solid #40a02b44; }
  .light-theme .review-changes-chip  { background: #d20f3922; color: #d20f39; border: 1px solid #d20f3944; }
  .light-theme .settings-modal {
    background: #e6e9ef !important;
    border-color: #bcc0cc !important;
    box-shadow: 0 16px 48px rgba(76,79,105,0.2) !important;
  }
  .light-theme .settings-header { background: #dce0e8; border-bottom-color: #bcc0cc; }
  .light-theme .settings-title { color: #4c4f69; }
  .light-theme .settings-label { color: #5c5f77; }
  .light-theme .settings-hint  { color: #8c8fa1; }
  .light-theme .settings-input { background: #eff1f5; border-color: #bcc0cc; color: #4c4f69; }
  .light-theme .settings-input:focus { border-color: #1e66f5; }
  .light-theme .settings-toggle-group { gap: 4px; }
  .light-theme .settings-toggle-btn { background: #eff1f5; border-color: #bcc0cc; color: #6c6f85; }
  .light-theme .settings-toggle-btn.active { background: #1e66f5; border-color: #1e66f5; color: #eff1f5; }
  .light-theme .settings-toggle-label { color: #4c4f69; }
  .light-theme .settings-footer { background: #dce0e8; border-top-color: #bcc0cc; }
  .light-theme .settings-switch { background: #acb0be; }
  .light-theme .settings-switch.active { background: #1e66f5; }
  .light-theme .settings-switch-knob { background: #eff1f5; }
  .light-theme .settings-switch.active .settings-switch-knob { background: #eff1f5; }
  .light-theme .btn { background: #eff1f5; border-color: #bcc0cc; color: #4c4f69; }
  .light-theme .btn:hover { background: #dce0e8; }
  .light-theme .btn-primary { background: #1e66f5 !important; border-color: #1e66f5 !important; color: #eff1f5 !important; }
  .light-theme .btn-primary:hover { background: #1655d0 !important; }
  .light-theme .btn-primary:disabled { background: #acb0be !important; border-color: #acb0be !important; }
  .light-theme .empty-state { color: #6c6f85; }
  .light-theme .loading-text { color: #6c6f85; }
  .light-theme .error-box { background: #f38ba822; border-color: #d20f3944; color: #d20f39; }
  .light-theme .lp-empty { color: #8c8fa1; }
  .light-theme .lp-draft-badge { background: rgba(140,143,161,0.2); color: #6c6f85; }
  .light-theme .milestone-tag { background: #ccd0da; color: #4c4f69; }

  /* ── Color-blind mode (deuteranopia-safe: swaps green/red → blue/orange) ── */
  .color-blind .ci-success { color: #89b4fa !important; }
  .color-blind .ci-failure { color: #fab387 !important; }
  .color-blind .ci-icon-success { background: #89b4fa !important; box-shadow: 0 0 4px #89b4fa66 !important; }
  .color-blind .ci-icon-failure { background: #fab387 !important; box-shadow: 0 0 4px #fab38766 !important; }
  .color-blind .review-approved { color: #89b4fa !important; }
  .color-blind .review-changes  { color: #fab387 !important; }
  .color-blind .review-approved-chip { background: rgba(137,180,250,0.18) !important; color: #89b4fa !important; border-color: rgba(137,180,250,0.38) !important; }
  .color-blind .review-changes-chip  { background: rgba(250,179,135,0.18) !important; color: #fab387 !important; border-color: rgba(250,179,135,0.38) !important; }
  .color-blind .diff-add { color: #89b4fa !important; }
  .color-blind .diff-del { color: #fab387 !important; }
  .color-blind .lp-ci-success  { background: #89b4fa !important; }
  .color-blind .lp-ci-fail     { background: #fab387 !important; }
  .color-blind .lp-review-approved { background: #89b4fa !important; }
  .color-blind .lp-review-changes  { background: #fab387 !important; }
  /* Also update the group color dots in LaunchpadView header */
  .color-blind .lp-group-icon[data-group="Ready to Merge"]    { color: #89b4fa !important; }
  .color-blind .lp-group-icon[data-group="CI Failing"]         { color: #fab387 !important; }
  .color-blind .lp-group-icon[data-group="Changes Requested"]  { color: #fab387 !important; }
`;

// Column metadata
const COLUMN_CONFIG: Record<string, { color: string; emoji: string }> = {
  'TODO':                  { color: '#585b70', emoji: '○' },
  'In Progress':           { color: '#89b4fa', emoji: '◑' },
  'Ready For Review':      { color: '#fab387', emoji: '👁' },
  'Ready For QA':          { color: '#f9e2af', emoji: '🔍' },
  'QA Done':               { color: '#a6e3a1', emoji: '✓' },
  'Done':                  { color: '#74c7ec', emoji: '✓✓' },
  'Blocked':               { color: '#f38ba8', emoji: '⊘' },
  'Needs Grooming':        { color: '#cba6f7', emoji: '✂' },
  'Grooming in Progress':  { color: '#b4befe', emoji: '⚙' },
  'Grooming to Review':    { color: '#f5c2e7', emoji: '⬡' },
};

function getColumnConfig(name: string) {
  return COLUMN_CONFIG[name] ?? { color: '#6c7086', emoji: '·' };
}

// ── Lightweight markdown renderer for the standup output ──────────────────────
// Only handles the exact patterns generated by generateStandupMarkdown.

function parseInlineMarkdown(text: string, onOpenUrl: (url: string) => void, key: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > cursor) {
      nodes.push(parseItalic(text.slice(cursor, m.index), `${key}-t${cursor}`));
    }
    const url = m[2];
    nodes.push(
      <a key={`${key}-l${m.index}`} href="#" className="standup-link"
        onClick={(e) => { e.preventDefault(); onOpenUrl(url); }}>
        {m[1]}
      </a>
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) nodes.push(parseItalic(text.slice(cursor), `${key}-t${cursor}`));
  return nodes.length === 1 ? nodes[0] : <React.Fragment key={key}>{nodes}</React.Fragment>;
}

function parseItalic(text: string, key: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const re = /\*([^*]+)\*/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) nodes.push(text.slice(cursor, m.index));
    nodes.push(<em key={`${key}-i${m.index}`} className="standup-em">{m[1]}</em>);
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length === 0 ? text : nodes.length === 1 ? nodes[0] : <React.Fragment key={key}>{nodes}</React.Fragment>;
}

function renderStandupMarkdown(md: string, onOpenUrl: (url: string) => void): React.ReactNode {
  const lines = md.split('\n');
  const els: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      els.push(<h2 key={i} className="standup-h2">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      els.push(<h3 key={i} className="standup-h3">{parseInlineMarkdown(line.slice(4), onOpenUrl, `${i}`)}</h3>);
    } else if (line.startsWith('- ')) {
      els.push(
        <div key={i} className="standup-li">
          <span className="standup-bullet">•</span>
          <span>{parseInlineMarkdown(line.slice(2), onOpenUrl, `${i}`)}</span>
        </div>
      );
    } else if (line.trim() === '') {
      els.push(<div key={i} className="standup-spacer" />);
    } else {
      els.push(<p key={i} className="standup-p">{parseInlineMarkdown(line, onOpenUrl, `${i}`)}</p>);
    }
  }
  return <div className="standup-rendered">{els}</div>;
}

// ──────────────────────────────────────────────────────────────────────────────

export function App() {
  const [state, setState] = useState<'loading' | 'error' | 'data'>('loading');
  const [data, setData] = useState<RunwayData | null>(null);
  const [config, setConfig] = useState<RunwayConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('dashboard');
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<BoardItem | null>(null);
  const [linkedPRs, setLinkedPRs] = useState<LinkedPR[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Phase 1: PR file deep linking
  const [prFiles, setPrFiles] = useState<PRFile[] | null>(null);
  // Phase 2: conflict threats
  const [conflictThreats, setConflictThreats] = useState<ConflictThreat[]>([]);
  // Phase 3: standup
  const [standupMarkdown, setStandupMarkdown] = useState<string | null>(null);
  const [standupLoading, setStandupLoading] = useState(false);
  const [standupView, setStandupView] = useState<'view' | 'markdown'>('view');
  // Phase 3: repo labels cache keyed by "owner/repo"
  const [repoLabelsCache, setRepoLabelsCache] = useState<Map<string, GHLabel[]>>(new Map());
  // v2: CODEOWNERS cache keyed by "owner/repo"
  const [codeownersCache, setCodeownersCache] = useState<Map<string, Array<{ pattern: string; owners: string[] }>>>(new Map());
  // §1.7: issue/PR body cache keyed by itemId — avoids re-fetching on every panel open
  const itemBodyCache = React.useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Inject styles once
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      switch (msg.type) {
        case 'loading':
          setIsRefreshing(true);
          if (state !== 'data') setState('loading');
          break;
        case 'data':
          setData(msg.payload);
          setState('data');
          setIsRefreshing(false);
          // Auto-select the latest sprint (sprints are sorted numeric desc so [0] is the highest)
          if (msg.payload.sprints.length > 0) {
            setSprintFilter((prev) => prev ?? msg.payload.sprints[0]);
          }
          break;
        case 'error':
          setErrorMsg(msg.message);
          setState('error');
          setIsRefreshing(false);
          break;
        case 'config':
          setConfig(msg.payload);
          break;
        case 'linkedPRs':
          setLinkedPRs(msg.prs);
          break;
        case 'itemBody':
          itemBodyCache.current.set(msg.itemId, msg.body);
          setDetailItem((prev) => prev && prev.id === msg.itemId ? { ...prev, body: msg.body } : prev);
          break;
        // Phase 1: PR files
        case 'prFiles':
          setPrFiles(msg.files);
          break;
        // Phase 2: conflict threats
        case 'conflictThreats':
          setConflictThreats(msg.threats);
          break;
        // Phase 3: standup
        case 'standup':
          setStandupMarkdown(msg.markdown);
          setStandupLoading(false);
          break;
        // Phase 3: metadata confirmed
        case 'metadataUpdated':
          setDetailItem((prev) =>
            prev && prev.id === msg.itemId
              ? { ...prev, labels: msg.labels, assignees: msg.assignees }
              : prev
          );
          break;
        // Phase 3: repo labels loaded
        case 'repoLabels': {
          const cacheKey = `${msg.owner}/${msg.repo}`;
          setRepoLabelsCache((prev) => new Map(prev).set(cacheKey, msg.labels));
          break;
        }
        // v2: draft converted to ready
        case 'prReadied':
          setDetailItem((prev) => prev && prev.id === msg.itemId ? { ...prev, isDraft: false } : prev);
          break;
        // v2: PR merged
        case 'prMerged':
          setDetailItem((prev) => prev && prev.id === msg.itemId ? { ...prev, state: 'MERGED' } : prev);
          break;
        // v2: CODEOWNERS loaded
        case 'codeowners': {
          const coKey = `${msg.owner}/${msg.repo}`;
          setCodeownersCache((prev) => new Map(prev).set(coKey, msg.entries));
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    // Request current config on mount
    vscodeApi.postMessage({ type: 'getConfig' });
    return () => window.removeEventListener('message', handler);
  }, [state]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    vscodeApi.postMessage({ type: 'refresh' });
  }, []);

  const handleOpenUrl = useCallback((url: string) => {
    vscodeApi.postMessage({ type: 'openUrl', url });
  }, []);

  const handleSaveConfig = useCallback((cfg: RunwayConfig) => {
    vscodeApi.postMessage({ type: 'updateConfig', payload: cfg });
    setConfig(cfg);
  }, []);

  // Apply visual mode classes on both body and #root.
  // body → needed for body-level background/color overrides.
  // #root → needed for position:fixed overlay descendants (detail panel, settings modal).
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const isLight = config?.theme === 'light';
    const isColorBlind = config?.colorBlind ?? false;
    const isLiquidGlass = config?.liquidGlass ?? false;
    root.classList.toggle('liquid-glass', isLiquidGlass);
    root.classList.toggle('light-theme', isLight);
    root.classList.toggle('color-blind', isColorBlind);
    document.body.classList.toggle('liquid-glass', isLiquidGlass);
    document.body.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('color-blind', isColorBlind);
  }, [config?.liquidGlass, config?.theme, config?.colorBlind]);

  const filteredGroups = useMemo((): Record<string, BoardItem[]> => {
    if (!data) return {};
    const q = search.toLowerCase().trim();

    const result: Record<string, BoardItem[]> = {};
    for (const col of data.columns) {
      let items = data.groups[col] ?? [];

      // Tab filter (milestones tab shows all types in its own view)
      if (tab === 'prs') items = items.filter((i) => i.type === 'PULL_REQUEST');
      if (tab === 'issues') items = items.filter((i) => i.type === 'ISSUE');

      // Sprint filter
      if (sprintFilter) items = items.filter((i) => i.sprint === sprintFilter);

      // Search filter
      if (q) {
        items = items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            String(i.number).includes(q) ||
            i.author.login.toLowerCase().includes(q) ||
            i.labels.some((l) => l.name.toLowerCase().includes(q)) ||
            i.repository.toLowerCase().includes(q) ||
            (i.headRefName ?? '').toLowerCase().includes(q) ||
            (i.sprint ?? '').toLowerCase().includes(q) ||
            (i.milestone?.title ?? '').toLowerCase().includes(q)
        );
      }

      result[col] = items;
    }
    return result;
  }, [data, search, tab, sprintFilter]);

  const milestoneGroups = useMemo((): Record<string, BoardItem[]> => {
    if (!data) return {};
    const allItems = Object.values(data.groups).flat();
    const q = search.toLowerCase().trim();

    let items = allItems;
    if (sprintFilter) items = items.filter((i) => i.sprint === sprintFilter);
    if (q) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          String(i.number).includes(q) ||
          i.author.login.toLowerCase().includes(q) ||
          i.labels.some((l) => l.name.toLowerCase().includes(q)) ||
          (i.milestone?.title ?? '').toLowerCase().includes(q)
      );
    }

    const groups: Record<string, BoardItem[]> = {};
    for (const item of items) {
      const key = item.milestone?.title ?? '(No Milestone)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [data, search, sprintFilter]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, prs: 0, issues: 0 };
    let all = Object.values(data.groups).flat();
    if (sprintFilter) all = all.filter((i) => i.sprint === sprintFilter);
    return {
      all: all.length,
      prs: all.filter((i) => i.type === 'PULL_REQUEST').length,
      issues: all.filter((i) => i.type === 'ISSUE').length,
    };
  }, [data, sprintFilter]);

  const handleSelectItem = useCallback((item: BoardItem) => {
    // Restore body from cache if available so the panel shows content instantly
    const cachedBody = itemBodyCache.current.get(item.id);
    setDetailItem(cachedBody !== undefined ? { ...item, body: cachedBody } : item);
    setLinkedPRs(null);
    setPrFiles(null);

    if (item.body === undefined && cachedBody === undefined) {
      vscodeApi.postMessage({
        type: 'fetchBody',
        itemId: item.id,
        owner: item.repositoryOwner,
        repo: item.repository,
        number: item.number,
        isIssue: item.type === 'ISSUE',
      });
    }
    if (item.type === 'ISSUE') {
      vscodeApi.postMessage({
        type: 'fetchLinkedPRs',
        itemId: item.id,
        owner: item.repositoryOwner,
        repo: item.repository,
        issueNumber: item.number,
      });
    }
    // Phase 1: fetch changed files for PRs
    if (item.type === 'PULL_REQUEST') {
      const prKey = `${item.repositoryOwner}/${item.repository}#${item.number}`;
      vscodeApi.postMessage({
        type: 'fetchPRFiles',
        prKey,
        owner: item.repositoryOwner,
        repo: item.repository,
        prNumber: item.number,
      });
      // v2: fetch CODEOWNERS if not already cached
      vscodeApi.postMessage({
        type: 'fetchCodeowners',
        owner: item.repositoryOwner,
        repo: item.repository,
      });
    }
  }, []);

  // Phase 1: open PR file in editor
  const handleOpenPRFile = useCallback((owner: string, repo: string, prNumber: number, filename: string, patch?: string) => {
    vscodeApi.postMessage({ type: 'openPRFile', owner, repo, prNumber, filename, patch });
  }, []);

  // Phase 1: work on this branch
  const handleWorkOnThis = useCallback((branchName: string, owner: string, repo: string) => {
    vscodeApi.postMessage({ type: 'workOnThis', branchName, owner, repo });
  }, []);

  // Phase 3: generate standup
  const handleGenerateStandup = useCallback(() => {
    if (!data?.viewerLogin) return;
    setStandupLoading(true);
    setStandupMarkdown(null);
    setStandupView('view');
    vscodeApi.postMessage({ type: 'generateStandup', viewerLogin: data.viewerLogin });
  }, [data?.viewerLogin]);

  // Phase 3: metadata update
  const handleUpdateMetadata = useCallback((itemId: string, owner: string, repo: string, issueNumber: number, labels?: string[], assignees?: string[]) => {
    vscodeApi.postMessage({ type: 'updateMetadata', itemId, owner, repo, issueNumber, labels, assignees });
  }, []);

  // Phase 3: fetch repo labels
  const handleFetchRepoLabels = useCallback((owner: string, repo: string) => {
    vscodeApi.postMessage({ type: 'fetchRepoLabels', owner, repo });
  }, []);

  // v2: convert draft to ready
  const handleConvertDraftToReady = useCallback((itemId: string, owner: string, repo: string, prNumber: number) => {
    vscodeApi.postMessage({ type: 'convertDraftToReady', itemId, owner, repo, prNumber });
  }, []);

  // v2: merge PR
  const handleMergePR = useCallback((itemId: string, owner: string, repo: string, prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase') => {
    vscodeApi.postMessage({ type: 'mergePR', itemId, owner, repo, prNumber, mergeMethod });
  }, []);

  const formatLastUpdated = (iso: string) => {
    const d = new Date(iso);
    return `Last refreshed at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <>
      {/* Header */}
      <div className="header">
        <div className="header-left">
          {/* Rocket icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#89b4fa' }}>
            <path d="M12 2C12 2 7 6 7 12C7 14.76 8.12 17.27 10 19L12 22L14 19C15.88 17.27 17 14.76 17 12C17 6 12 2 12 2Z" fill="currentColor" opacity="0.9"/>
            <circle cx="12" cy="12" r="2" fill="#13131c"/>
            <path d="M9 19L7 21L5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M15 19L17 21L19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="header-title">
            SprintHub
            {data?.projectTitle && (
              <span className="project-name">· {data.projectTitle}</span>
            )}
          </span>
        </div>
        <div className="header-right">
          {data && <span className="total-badge">{data.totalCount} items</span>}
          {/* Phase 3: Standup Generator */}
          {data && (
            <button
              className={`btn${standupLoading ? ' loading' : ''}`}
              onClick={handleGenerateStandup}
              disabled={standupLoading}
              title="Generate daily standup"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Standup
            </button>
          )}
          {/* Settings button */}
          <button className="btn" onClick={() => setSettingsOpen(true)} title="Project settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button className={`btn${isRefreshing ? ' loading' : ''}`} onClick={handleRefresh}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Toolbar / tabs */}
      <div className="toolbar">
        {(['dashboard', 'all', 'prs', 'issues', 'milestones'] as FilterTab[]).map((t) => {
          const labels: Record<FilterTab, string> = { dashboard: '🚀 Dashboard', all: 'Main Board', prs: 'Pull Requests', issues: 'Issues', milestones: 'Milestones' };
          const tabCounts: Record<FilterTab, number> = {
            dashboard: counts.prs,
            all: counts.all,
            prs: counts.prs,
            issues: counts.issues,
            milestones: data ? Object.keys(milestoneGroups).length : 0,
          };
          return (
            <button
              key={t}
              className={`tab-btn${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {labels[t]}
              {t !== 'dashboard' && <span className="tab-count">{tabCounts[t]}</span>}
            </button>
          );
        })}
      </div>

      {/* Phase 2: Conflict Threats Banner */}
      {conflictThreats.length > 0 && (
        <div className="conflict-banner">
          <svg className="conflict-banner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div className="conflict-banner-body">
            <div className="conflict-banner-title">
              {conflictThreats.length} file conflict{conflictThreats.length > 1 ? 's' : ''} detected with open PRs
            </div>
            <div className="conflict-banner-items">
              {conflictThreats.slice(0, 3).map((t, i) => (
                <div key={i} className="conflict-banner-item">
                  <strong>{t.filename}</strong> — also modified in PR #{t.prNumber} by {t.prAuthor}
                </div>
              ))}
              {conflictThreats.length > 3 && (
                <div className="conflict-banner-item">…and {conflictThreats.length - 3} more</div>
              )}
            </div>
          </div>
          <button className="conflict-banner-dismiss" onClick={() => setConflictThreats([])} title="Dismiss">×</button>
        </div>
      )}

      {/* Sprint filter dropdown */}
      {data && data.sprints.length > 0 && (
        <div className="sprint-bar">
          <span className="sprint-label">Sprint</span>
          <select
            className="sprint-select"
            value={sprintFilter ?? ''}
            onChange={(e) => setSprintFilter(e.target.value || null)}
          >
            <option value="">All sprints</option>
            {data.sprints.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {sprintFilter && (
            <span className="sprint-active-badge">
              {sprintFilter}
              <button className="sprint-clear-btn" onClick={() => setSprintFilter(null)} title="Clear sprint filter">✕</button>
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="search-wrap">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="search-input"
          placeholder={tab === 'milestones' ? 'Search milestones and items…' : 'Search by title, number, author, label, branch, sprint…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      <div className="content">
        {state === 'loading' && (
          <div className="center-state">
            <div className="spinner" />
            <span className="state-title">Loading project…</span>
          </div>
        )}

        {state === 'error' && (
          <div className="center-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f38ba8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="state-title state-err">Failed to load</span>
            <span className="state-sub">{errorMsg}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setSettingsOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Open Settings
              </button>
              <button className="btn" onClick={handleRefresh}>Try again</button>
            </div>
          </div>
        )}

        {state === 'data' && data && (
          <>
            {tab === 'dashboard' ? (
              /* Dashboard view — PRs grouped by action needed */
              <LaunchpadView
                items={data.columns.flatMap((c) => data.groups[c] ?? [])}
                linkedIssuePRs={data.linkedIssuePRs ?? []}
                viewerLogin={data.viewerLogin ?? ''}
                onSelect={handleSelectItem}
                onOpenUrl={handleOpenUrl}
              />
            ) : tab === 'milestones' ? (
              /* Milestones view */
              Object.keys(milestoneGroups).length === 0 ? (
                <div className="milestone-empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#45475a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 4l3 3-3 3"/><path d="M3 7h18"/>
                    <path d="M6 20l-3-3 3-3"/><path d="M21 17H3"/>
                  </svg>
                  No milestones found
                </div>
              ) : (
                Object.entries(milestoneGroups).map(([milestone, items]) => (
                  <ColumnGroup
                    key={milestone}
                    column={milestone}
                    items={items}
                    config={{ color: '#cba6f7', emoji: '⬡' }}
                    onSelect={handleSelectItem}
                    onOpenUrl={handleOpenUrl}
                  />
                ))
              )
            ) : (
              /* Board view */
              data.columns.map((col) => {
                const items = filteredGroups[col] ?? [];
                return (
                  <ColumnGroup
                    key={col}
                    column={col}
                    items={items}
                    config={getColumnConfig(col)}
                    onSelect={handleSelectItem}
                    onOpenUrl={handleOpenUrl}
                  />
                );
              })
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="footer">
          {formatLastUpdated(data.lastUpdated)}
          {sprintFilter && <span style={{ marginLeft: 8, color: '#89b4fa' }}>· Sprint: {sprintFilter}</span>}
        </div>
      )}

      {/* Detail panel */}
      {detailItem && (
        <DetailPanel
          item={detailItem}
          linkedPRs={linkedPRs}
          prFiles={prFiles}
          repoLabels={repoLabelsCache.get(`${detailItem.repositoryOwner}/${detailItem.repository}`) ?? []}
          codeownersEntries={codeownersCache.get(`${detailItem.repositoryOwner}/${detailItem.repository}`) ?? []}
          onClose={() => { setDetailItem(null); setLinkedPRs(null); setPrFiles(null); }}
          actions={{
            onOpenUrl: handleOpenUrl,
            onWorkOnThis: handleWorkOnThis,
            onOpenPRFile: handleOpenPRFile,
            onUpdateMetadata: handleUpdateMetadata,
            onFetchRepoLabels: handleFetchRepoLabels,
            onConvertDraftToReady: handleConvertDraftToReady,
            onMergePR: handleMergePR,
          }}
        />
      )}

      {/* Phase 3: Standup modal */}
      {(standupLoading || standupMarkdown !== null) && (
        <div className="standup-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setStandupMarkdown(null); setStandupLoading(false); } }}>
          <div className="standup-modal">
            <div className="standup-header">
              <span className="standup-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Daily Standup
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* View toggle — only shown when content is ready */}
                {standupMarkdown && (
                  <div className="standup-view-toggle">
                    <button
                      className={`standup-view-btn${standupView === 'view' ? ' active' : ''}`}
                      onClick={() => setStandupView('view')}
                    >
                      View
                    </button>
                    <button
                      className={`standup-view-btn${standupView === 'markdown' ? ' active' : ''}`}
                      onClick={() => setStandupView('markdown')}
                    >
                      Markdown
                    </button>
                  </div>
                )}
                <button className="detail-close-btn" onClick={() => { setStandupMarkdown(null); setStandupLoading(false); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="standup-body">
              {standupLoading && !standupMarkdown && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6c7086', fontSize: 12 }}>
                  <div style={{ width: 12, height: 12, border: '2px solid #45475a', borderTopColor: '#89b4fa', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
                  Fetching your GitHub activity…
                </div>
              )}
              {standupMarkdown && standupView === 'view' && renderStandupMarkdown(standupMarkdown, handleOpenUrl)}
              {standupMarkdown && standupView === 'markdown' && <pre className="standup-md">{standupMarkdown}</pre>}
            </div>
            {standupMarkdown && (
              <div className="standup-footer">
                <button className="btn" onClick={() => { setStandupMarkdown(null); setStandupLoading(false); }}>Close</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    navigator.clipboard?.writeText(standupMarkdown!).catch(() => undefined);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy Markdown
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && config && (
        <SettingsPanel
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {settingsOpen && !config && (
        <SettingsPanel
          config={{ owner: '', projectNumber: 0, ownerType: 'organization', statusFieldName: 'Status', refreshInterval: 5, liquidGlass: false }}
          onSave={handleSaveConfig}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
