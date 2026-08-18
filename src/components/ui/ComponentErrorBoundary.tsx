'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { H } from '@/lib/honey'

interface Props {
  children: ReactNode
  sectionName?: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * ComponentErrorBoundary — Granular, component-level React error boundary.
 * Prevents isolated UI component failures (e.g. chat, calendar, widgets)
 * from crashing the full page view.
 */
export class ComponentErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ComponentErrorBoundary - ${this.props.sectionName || 'Widget'}]:`, error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={{
            padding: '24px',
            borderRadius: '16px',
            backgroundColor: H.surface,
            border: `1px dashed ${H.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '12px',
            minHeight: '160px',
            fontFamily: H.font,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: H.dangerLight,
              color: H.danger,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>
              {this.props.sectionName ? `${this.props.sectionName} failed to load` : 'This section failed to load'}
            </h4>
            <p style={{ fontSize: '12px', color: H.textSec, margin: '4px 0 0' }}>
              An isolated error occurred. You can retry loading this section.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '10px',
              backgroundColor: '#18181B',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
