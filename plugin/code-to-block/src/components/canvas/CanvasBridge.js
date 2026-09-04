import { Component, createPortal } from '@wordpress/element';

export class CanvasBridge extends Component {
	constructor( props ) {
		super( props );
		this.state = { iframeLoaded: false };
		this.iframeRef = ( node ) => {
			this.iframeNode = node;
		};
		this.handleLoad = this.handleLoad.bind( this );
	}

	componentDidMount() {
		if ( this.iframeNode ) {
			this.iframeNode.addEventListener( 'load', this.handleLoad );
		}
	}

	componentWillUnmount() {
		if ( this.iframeNode ) {
			this.iframeNode.removeEventListener( 'load', this.handleLoad );
		}
		if ( this.doc ) {
			this.doc.removeEventListener( 'pointerdown', this.handlePointerDown );
		}
	}

	handleLoad() {
		this.doc = this.iframeNode.contentDocument;
		if ( this.doc ) {
			this.doc.addEventListener( 'pointerdown', this.handlePointerDown.bind(this) );
			// Inject styles
			if ( this.props.styles ) {
				const styleEl = this.doc.createElement('style');
				styleEl.textContent = this.props.styles;
				this.doc.head.appendChild(styleEl);
			}
			this.setState( { iframeLoaded: true } );
		}
	}

	handlePointerDown( event ) {
		const target = event.target;
		const node = target.closest('[data-ctb-node]');
		if ( node ) {
			const nodeId = node.getAttribute('data-ctb-node');
			if ( this.props.onSelectNode ) {
				this.props.onSelectNode( nodeId );
			}
			
			// Post message to parent for external listeners
			window.postMessage({
				type: 'CTB_NODE_SELECTED',
				nodeId: nodeId
			}, '*');
		}
	}

	render() {
		const { children, className } = this.props;

		return (
			<iframe
				ref={ this.iframeRef }
				className={ className }
				srcDoc="<!DOCTYPE html><html><head></head><body></body></html>"
				style={ { width: '100%', height: '100%', border: 'none' } }
				sandbox="allow-same-origin allow-scripts"
			>
				{ this.state.iframeLoaded && this.doc
					? createPortal( children, this.doc.body )
					: null }
			</iframe>
		);
	}
}
