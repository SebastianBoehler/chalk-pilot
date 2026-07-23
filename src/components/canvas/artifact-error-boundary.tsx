"use client";

import { Component, type ReactNode } from "react";

interface ArtifactErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface ArtifactErrorBoundaryState {
  failed: boolean;
}

export class ArtifactErrorBoundary extends Component<
  ArtifactErrorBoundaryProps,
  ArtifactErrorBoundaryState
> {
  state: ArtifactErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ArtifactErrorBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previousProps: ArtifactErrorBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch() {
    // The fallback is intentionally local: one bad artifact must not hide the canvas.
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="text-danger" role="status">
          This learning artifact is unavailable.
        </p>
      );
    }

    return this.props.children;
  }
}
