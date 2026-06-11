import React from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <div className="max-w-2xl w-full">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-destructive mb-2">Application Error</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Something went wrong. Check the browser console for details.
              </p>
              <pre className="text-xs bg-muted rounded p-4 overflow-auto max-h-64 text-foreground">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
              <button
                onClick={() => { this.setState({ error: null }); window.location.reload(); }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
