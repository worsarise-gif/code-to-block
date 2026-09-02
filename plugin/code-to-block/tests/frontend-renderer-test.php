<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_PATH', dirname( __DIR__ ) . '/' );

final class WP_Error {
	public function __construct( $code, $message, $data = null ) {
		unset( $code, $message, $data );
	}
}

final class Code_To_Block_Forms {
	public static function create_submission_token( $post_id, $form_id, $timestamp ) {
		return hash( 'sha256', $post_id . '|' . $form_id . '|' . $timestamp );
	}
}

final class Renderer_WC_Product {
	private $id;
	private $name;
	public function __construct( $id, $name ) { $this->id = $id; $this->name = $name; }
	public function get_id() { return $this->id; }
	public function get_name() { return $this->name; }
	public function get_price_html() { return '$19.00'; }
	public function get_short_description() { return 'Short description'; }
	public function get_image_id() { return 0; }
	public function is_in_stock() { return true; }
}

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

function esc_html( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function esc_attr( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function esc_url( $value ) {
	return preg_match( '/^javascript:/i', trim( $value ) ) ? '' : esc_attr( $value );
}

function sanitize_text_field( $value ) {
	return trim( strip_tags( $value ) );
}

function wp_json_encode( $value, $flags = 0 ) {
	return json_encode( $value, $flags );
}

function wp_kses_post( $value ) { return $value; }
function get_post_type( $post_id ) {
	global $renderer_products;
	return isset( $renderer_products[ $post_id ] ) ? 'product' : CODE_TO_BLOCK_POST_TYPE;
}
function wc_get_product( $product_id ) {
	global $renderer_products;
	return isset( $renderer_products[ $product_id ] ) ? $renderer_products[ $product_id ] : false;
}
function wc_get_stock_html() { return ''; }

$renderer_logged_in = false;
$renderer_roles     = array();
function is_user_logged_in() {
	global $renderer_logged_in;
	return $renderer_logged_in;
}
function wp_get_current_user() {
	global $renderer_roles;
	return (object) array( 'roles' => $renderer_roles );
}

function wp_kses( $value, $allowed ) {
	$tags = '<' . implode( '><', array_keys( $allowed ) ) . '>';
	$value = strip_tags( $value, $tags );
	return preg_replace_callback(
		'/<([a-z]+)([^>]*)>/i',
		function ( $match ) {
			$tag = strtolower( $match[1] );
			if ( 'a' !== $tag ) {
				return '<' . $tag . '>';
			}
			$attributes = '';
			foreach ( array( 'href', 'rel', 'target' ) as $name ) {
				if ( preg_match( '/\s' . $name . '=(?:"([^"]*)"|\'([^\']*)\')/i', $match[2], $attribute ) ) {
					$value = '' !== $attribute[1] ? $attribute[1] : $attribute[2];
					if ( 'href' === $name && preg_match( '/^javascript:/i', trim( $value ) ) ) continue;
					$attributes .= ' ' . $name . '="' . esc_attr( $value ) . '"';
				}
			}
			return '<a' . $attributes . '>';
		},
		$value
	);
}

function home_url() {
	return 'https://example.test';
}

function rest_url( $path ) {
	return 'https://example.test/wp-json/' . ltrim( $path, '/' );
}

function trailingslashit( $value ) {
	return rtrim( $value, '/\\' ) . '/';
}

$renderer_options    = array();
$shortcode_tags      = array();
$renderer_queried_id = 99;
$renderer_products   = array(
	501 => new Renderer_WC_Product( 501, 'Explicit product' ),
	999 => new Renderer_WC_Product( 999, 'Unrelated global product' ),
);

function get_option( $key, $default = false ) {
	global $renderer_options;
	return array_key_exists( $key, $renderer_options ) ? $renderer_options[ $key ] : $default;
}

function add_option( $key, $value ) {
	global $renderer_options;
	if ( array_key_exists( $key, $renderer_options ) ) {
		return false;
	}
	$renderer_options[ $key ] = $value;
	return true;
}

function update_option( $key, $value ) {
	global $renderer_options;
	$changed = ! array_key_exists( $key, $renderer_options ) || $renderer_options[ $key ] != $value;
	$renderer_options[ $key ] = $value;
	return $changed;
}

function delete_option( $key ) {
	global $renderer_options;
	unset( $renderer_options[ $key ] );
	return true;
}

function wp_generate_uuid4() {
	return uniqid( 'renderer-', true );
}

function current_user_can() {
	return true;
}

function rest_authorization_required_code() {
	return 403;
}

function get_current_user_id() {
	return 1;
}

function current_time() {
	return '2026-08-20 12:00:00';
}

function shortcode_exists( $tag ) {
	global $shortcode_tags;
	return isset( $shortcode_tags[ $tag ] );
}

function add_shortcode( $tag, $callback ) {
	global $shortcode_tags;
	$shortcode_tags[ $tag ] = $callback;
}

function remove_shortcode( $tag ) {
	global $shortcode_tags;
	unset( $shortcode_tags[ $tag ] );
}

function do_shortcode( $source ) {
	global $shortcode_tags;
	return preg_replace_callback(
		'/\[([a-z0-9_-]+)\]/',
		static function ( $match ) use ( &$shortcode_tags ) {
			return isset( $shortcode_tags[ $match[1] ] ) ? call_user_func( $shortcode_tags[ $match[1] ], array(), null, $match[1] ) : $match[0];
		},
		$source
	);
}

function get_post( $post_id ) {
	return 99 === (int) $post_id ? (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'publish' ) : null;
}

function is_post_publicly_viewable( $post ) {
	return $post && 'publish' === $post->post_status;
}

function is_singular( $post_type = '' ) {
	return '' === $post_type || CODE_TO_BLOCK_POST_TYPE === $post_type;
}

function get_queried_object_id() {
	global $renderer_queried_id;
	return $renderer_queried_id;
}

function wp_upload_dir() {
	return array( 'basedir' => ABSPATH . 'uploads', 'error' => false );
}

function do_action() {
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-registry.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-schema.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-php-scanner.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-shortcodes.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-renderer.php';

$assertions = 0;

function assert_renderer( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

$fixtures = json_decode( file_get_contents( dirname( __DIR__, 3 ) . '/block-examples.json' ) );
foreach ( $fixtures as $fixture_index => $fixture ) {
	$document = Code_To_Block_Schema::sanitize_document( $fixture );
	assert_renderer( ! is_wp_error( $document ), 'Fixture must validate before rendering.' );
	$html = Code_To_Block_Renderer::render_document( $document, 42 + $fixture_index );
	$css  = Code_To_Block_Renderer::generate_css( $document, 42 + $fixture_index );
	assert_renderer( false !== strpos( $html, 'class="ctb-page"' ), 'Rendered documents need a scoped page wrapper.' );
	assert_renderer( false !== strpos( $html, 'ctb-block-0' ), 'The root needs a stable generated style class.' );
	assert_renderer( false !== strpos( $css, '#ctb-page-' . ( 42 + $fixture_index ) . ' .ctb-block-0{' ), 'Root styles must be scoped to the owning page.' );
}

$optional                                      = json_decode( json_encode( $fixtures[0] ) );
$optional->root->responsive_overrides          = new stdClass();
$optional->root->responsive_overrides->tablet  = (object) array(
	'mapped'              => (object) array( 'padding' => '20px' ),
	'custom_css_fallback' => '',
);
$optional->root->responsive_overrides->mobile  = (object) array(
	'mapped'              => (object) array( 'padding' => '12px' ),
	'custom_css_fallback' => '',
);
$optional->root->states                        = new stdClass();
$optional->root->states->hover                 = (object) array(
	'mapped'              => (object) array( 'color' => 'rebeccapurple' ),
	'custom_css_fallback' => '',
);
$optional->root->states->active                = (object) array(
	'mapped'              => (object) array( 'transform' => 'translateY(1px)' ),
	'custom_css_fallback' => '',
);
$optional->root->children[3]->attributes->target = ' _BLANK ';
$optional->root->children[3]->attributes->rel    = 'NOOPENER custom';
$optional->root->children[3]->attributes->href   = 'javascript:alert(1)';
$optional->root->attributes->class               = 'pricing-card ctb-block-12';
$optional->root->children[0]->children[0]->value = '<strong>not markup</strong>';
$optional->root->children[3]->actions = array(
	(object) array(
		'trigger'  => 'click',
		'behavior' => 'toggle-class',
		'params'   => (object) array(
			'target_block_id' => $optional->root->id,
			'class_name'      => 'is-open',
		),
	),
	(object) array(
		'trigger'  => 'manual-review',
		'behavior' => 'unverified-script',
		'params'   => (object) array(
			'code'        => '</script><script>alert(1)</script>',
			'description' => 'Manual review only.',
		),
	),
	(object) array(
		'trigger'        => 'scroll',
		'behavior'       => 'scroll-scrub',
		'animation_type' => 'js_library',
		'params'         => (object) array(
			'target_block_id' => $optional->root->children[3]->id,
			'start'           => 'top 85%',
			'end'             => 'bottom 20%',
			'scrub'           => 1,
		),
	),
	(object) array(
		'trigger'        => 'load',
		'behavior'       => 'css-reveal',
		'animation_type' => 'css_native',
		'params'         => (object) array(
			'target_block_id' => $optional->root->children[3]->id,
			'duration'        => 0.8,
			'delay'           => 0.1,
			'from_y'          => 24,
		),
	),
);
$document = Code_To_Block_Schema::sanitize_document( $optional );
$html     = Code_To_Block_Renderer::render_document( $document, 99 );
$css      = Code_To_Block_Renderer::generate_css( $document, 99 );

assert_renderer( false === strpos( $html, 'javascript:' ), 'Unsafe URL protocols must not render.' );
assert_renderer( false !== strpos( $html, 'noopener noreferrer' ), 'New-tab links must prevent opener access.' );
assert_renderer( false !== strpos( $html, 'target="_blank"' ), 'Reserved new-tab targets must be canonicalized case-insensitively.' );
assert_renderer( 1 === substr_count( $html, 'noopener' ), 'Existing rel protections must be normalized without duplicates.' );
assert_renderer( false === strpos( $html, 'ctb-block-12' ), 'Imported classes must not collide with generated style classes.' );
assert_renderer( false !== strpos( $html, '&lt;strong&gt;not markup&lt;/strong&gt;' ), 'Text nodes must be HTML-escaped.' );
assert_renderer( false !== strpos( $html, 'data-ctb-block-id="pricing-card"' ), 'Rendered blocks need safe runtime target IDs.' );
assert_renderer( false !== strpos( $html, 'data-ctb-actions=' ), 'Allowlisted actions must be emitted as escaped structured data.' );
assert_renderer( false !== strpos( $html, 'toggle-class' ), 'The structured runtime behavior must render.' );
assert_renderer( false !== strpos( $html, 'data-ctb-animations=' ), 'Constrained GSAP actions must be emitted separately from click actions.' );
assert_renderer( false !== strpos( $html, 'scroll-scrub' ), 'The frontend must receive serialized scroll-scrub configuration.' );
assert_renderer( false !== strpos( $html, 'data-ctb-css-animation="reveal"' ), 'CSS-native entrance actions must render without JavaScript data.' );
assert_renderer( false !== strpos( $css, '--ctb-reveal-duration:0.8s' ), 'CSS-native controls must render as constrained custom properties.' );
assert_renderer( false !== strpos( $css, '@keyframes ctb-reveal-99' ), 'The generated stylesheet must include the CSS-native reveal keyframes.' );
assert_renderer( false === strpos( $html, '<script>alert(1)</script>' ), 'Unverified script metadata must never render as executable or visible public markup.' );
assert_renderer( false !== strpos( $css, '.ctb-block-0:hover{color:rebeccapurple!important;}' ), 'Hover styles must render.' );
assert_renderer( false !== strpos( $css, '.ctb-block-0:active{transform:translateY(1px)!important;}' ), 'Active styles must render.' );
assert_renderer( false !== strpos( $css, '@media (max-width:1024px)' ), 'Tablet overrides must render.' );
assert_renderer( false !== strpos( $css, '@media (max-width:767px)' ), 'Mobile overrides must render.' );

$conditional_fixture = json_decode( json_encode( $fixtures[0] ) );
$conditional_fixture->root->visibility_conditions = (object) array(
	'login' => 'logged_in',
	'roles' => array( 'editor' ),
);
$conditional_document = Code_To_Block_Schema::sanitize_document( $conditional_fixture );
$conditional_html = Code_To_Block_Renderer::render_document( $conditional_document, 99 );
assert_renderer( false === strpos( $conditional_html, 'Professional' ), 'Logged-in conditions must hide blocks from logged-out visitors.' );
$renderer_logged_in = true;
$renderer_roles = array( 'editor' );
$conditional_html = Code_To_Block_Renderer::render_document( $conditional_document, 99 );
assert_renderer( false !== strpos( $conditional_html, 'Professional' ), 'Matching WordPress roles must reveal conditional blocks.' );
$renderer_roles = array( 'subscriber' );
$conditional_html = Code_To_Block_Renderer::render_document( $conditional_document, 99 );
assert_renderer( false === strpos( $conditional_html, 'Professional' ), 'Nonmatching WordPress roles must keep conditional blocks hidden.' );
$renderer_logged_in = false;
$renderer_roles = array();

$lazy_fixture = json_decode( json_encode( $fixtures[2] ) );
$lazy_fixture->root->children[0]->performance = (object) array( 'image_lazy_load' => true );
$lazy_document = Code_To_Block_Schema::sanitize_document( $lazy_fixture );
$lazy_html = Code_To_Block_Renderer::render_document( $lazy_document, 99 );
assert_renderer( false !== strpos( $lazy_html, 'loading="lazy"' ), 'Lazy images must use native loading deferral.' );
assert_renderer( false !== strpos( $lazy_html, 'data-ctb-lazy-media="true"' ), 'Lazy images must join the shared skeleton lifecycle.' );

$rich_fixture = json_decode( json_encode( $fixtures[0] ) );
$rich_fixture->root->children[0]->is_content_slot = true;
$rich_fixture->root->children[0]->slot_label = 'Formatted introduction';
$rich_fixture->root->children[0]->slot_content_type = 'rich_text';
$rich_fixture->root->children[0]->children[0]->value = '<strong onclick="alert(1)">Safe emphasis</strong><script>alert(2)</script>';
$rich_document = Code_To_Block_Schema::sanitize_document( $rich_fixture );
$rich_html = Code_To_Block_Renderer::render_document( $rich_document, 99 );
assert_renderer( false !== strpos( $rich_html, '<strong>Safe emphasis</strong>' ), 'Rich-text slots must render allowed inline formatting.' );
assert_renderer( false === strpos( $rich_html, '<script' ) && false === strpos( $rich_html, 'onclick=' ), 'Rich-text slots must remove executable markup and event attributes.' );

$commerce_fixture = json_decode( json_encode( $fixtures[0] ) );
$commerce_fixture->root->children = array(
	(object) array(
		'id' => 'cart-block', 'type' => 'woocommerce_cart', 'tag' => 'div', 'attributes' => new stdClass(), 'children' => array(),
		'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ), 'meta' => (object) array( 'source' => 'test' ),
	),
	(object) array(
		'id' => 'checkout-block', 'type' => 'woocommerce_checkout', 'tag' => 'div', 'attributes' => new stdClass(), 'children' => array(),
		'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ), 'meta' => (object) array( 'source' => 'test' ),
	),
	(object) array(
		'id' => 'product-block', 'type' => 'woocommerce_product', 'tag' => 'article', 'attributes' => (object) array( 'data-product-id' => '501' ),
		'children' => array(
			(object) array(
				'id' => 'product-title', 'type' => 'text', 'tag' => 'h2', 'attributes' => new stdClass(), 'children' => array( (object) array( 'kind' => 'text', 'value' => '' ) ),
				'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ), 'meta' => (object) array( 'source' => 'test' ),
				'is_dynamic' => true, 'dynamic_source' => 'wc_product_title',
			),
		),
		'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ), 'meta' => (object) array( 'source' => 'test' ),
	),
);
$commerce_document = Code_To_Block_Schema::sanitize_document( $commerce_fixture );
$product = $renderer_products[999];
$commerce_html = Code_To_Block_Renderer::render_document( $commerce_document, 99 );
assert_renderer( false !== strpos( $commerce_html, '<!-- wp:woocommerce/cart -->' ) && false !== strpos( $commerce_html, '<!-- wp:woocommerce/cart-line-items-block -->' ), 'Cart blocks must render the official WooCommerce Cart Block and its required InnerBlocks.' );
assert_renderer( false !== strpos( $commerce_html, '<!-- wp:woocommerce/checkout -->' ) && false !== strpos( $commerce_html, '<!-- wp:woocommerce/checkout-payment-block -->' ), 'Checkout blocks must render the official WooCommerce Checkout Block and its required InnerBlocks.' );
assert_renderer( false === strpos( $commerce_html, '[woocommerce_cart]' ) && false === strpos( $commerce_html, '[woocommerce_checkout]' ), 'Commerce blocks must never copy legacy cart or checkout shortcodes.' );
assert_renderer( false !== strpos( $commerce_html, 'Explicit product' ) && false === strpos( $commerce_html, 'Unrelated global product' ), 'Explicit product context must override WooCommerce global state.' );
$commerce_fixture->root->children[2]->attributes = new stdClass();
$empty_product_document = Code_To_Block_Schema::sanitize_document( $commerce_fixture );
$empty_product_html = Code_To_Block_Renderer::render_document( $empty_product_document, 99 );
assert_renderer( false !== strpos( $empty_product_html, 'Select a valid WooCommerce product.' ), 'A CTB page without an explicit product must show a selection state instead of using the page ID.' );

$token_fixture = json_decode( json_encode( $fixtures[0] ) );
$token_fixture->design_tokens = (object) array(
	'colors' => (object) array(
		'brand' => (object) array( 'label' => 'Brand', 'value' => '#6558d3' ),
	),
	'spacing' => (object) array(
		'section' => (object) array( 'label' => 'Section', 'value' => '48px' ),
	),
);
foreach ( array( 0, 1, 2 ) as $child_index ) {
	$token_fixture->root->children[ $child_index ]->styles->mapped->color = 'var(--ctb-token-colors-brand)';
	$token_fixture->root->children[ $child_index ]->styles->token_bindings = (object) array( 'color' => 'colors.brand' );
}
$token_fixture->root->children[1]->styles->mapped->color = '#222222';
$token_fixture->root->responsive_overrides = (object) array(
	'tablet' => (object) array(
		'mapped' => (object) array( 'padding' => 'var(--ctb-token-spacing-section)' ),
		'custom_css_fallback' => '',
		'token_bindings' => (object) array( 'padding' => 'spacing.section' ),
	),
);
$token_document = Code_To_Block_Schema::sanitize_document( $token_fixture );
assert_renderer( ! is_wp_error( $token_document ), 'Token renderer fixture must validate.' );
$token_css = Code_To_Block_Renderer::generate_css( $token_document, 101 );
assert_renderer( false !== strpos( $token_css, '#ctb-page-101{--ctb-token-colors-brand:#6558d3;--ctb-token-spacing-section:48px;}' ), 'Token declarations must be scoped once to the owning page.' );
assert_renderer( 2 === substr_count( $token_css, 'color:var(--ctb-token-colors-brand)!important;' ), 'Two linked blocks must keep the shared color reference.' );
assert_renderer( false !== strpos( $token_css, 'color:#222222!important;' ), 'A local token override must render its raw block value.' );
assert_renderer( false !== strpos( $token_css, '@media (max-width:1024px)' ) && false !== strpos( $token_css, 'padding:var(--ctb-token-spacing-section)!important;' ), 'Responsive styles must render token references inside their media rule.' );
$token_document['design_tokens']->colors->brand['value'] = '#d12f5b';
$updated_token_css = Code_To_Block_Renderer::generate_css( $token_document, 101 );
assert_renderer( false !== strpos( $updated_token_css, '--ctb-token-colors-brand:#d12f5b;' ), 'Changing a global token must update its single scoped declaration.' );
assert_renderer( 2 === substr_count( $updated_token_css, 'color:var(--ctb-token-colors-brand)!important;' ) && false !== strpos( $updated_token_css, 'color:#222222!important;' ), 'Global token changes must preserve linked consumers and local overrides.' );

$hero_document = Code_To_Block_Schema::sanitize_document( $fixtures[1] );
$hero_css      = Code_To_Block_Renderer::generate_css( $hero_document, 100 );
assert_renderer( false !== strpos( $hero_css, 'url("https://example.test/hero.jpg")' ), 'Relative CSS resources must resolve from the site root.' );

$form_fixture = json_decode( json_encode( $fixtures[0] ) );
$form_fixture->root->children = array(
	(object) array(
		'id'         => 'contact-form',
		'type'       => 'form',
		'tag'        => 'form',
		'attributes' => (object) array(
			'data-submission' => 'native',
			'data-email-to'   => 'private@example.test',
			'data-submit-label' => 'Send message',
		),
		'children'   => array(),
		'styles'     => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
		'meta'       => (object) array( 'source' => 'test' ),
	),
);
$form_document = Code_To_Block_Schema::sanitize_document( $form_fixture );
assert_renderer( ! is_wp_error( $form_document ), 'Native form fixture must validate.' );
$form_html = Code_To_Block_Renderer::render_document( $form_document, 99 );
assert_renderer( false !== strpos( $form_html, 'class="ctb-block ctb-block-1 ctb-form"' ), 'Native forms need the runtime class.' );
assert_renderer( false !== strpos( $form_html, 'method="post"' ), 'Native forms need a POST method.' );
assert_renderer( false !== strpos( $form_html, 'action="https://example.test/wp-json/code-to-block/v1/forms/99/submit"' ), 'Native forms need the REST action.' );
assert_renderer( false !== strpos( $form_html, 'name="_ctb_submission_token"' ), 'Native forms need a signed timing token.' );
assert_renderer( false !== strpos( $form_html, '>Send message</button>' ), 'Native forms must preserve their configured submit label.' );
assert_renderer( false === strpos( $form_html, 'private@example.test' ), 'Notification email addresses must not be exposed in public markup.' );

$php_source = '<?php return "<b class=\"confirmed-php\">Confirmed PHP</b>"; ?>';
$php_review = Code_To_Block_Shortcodes::review_source( 'ctb_php_99_renderer', $php_source );
$php_registered = Code_To_Block_Shortcodes::register_reviewed(
	99,
	'ctb_php_99_renderer',
	$php_source,
	$php_review['review']['hash'],
	$php_review['confirmation_phrase']
);
assert_renderer( ! is_wp_error( $php_registered ), 'The renderer integration fixture must register after source-bound confirmation.' );
$php_fixture = json_decode( json_encode( $fixtures[0] ) );
$php_fixture->root->attributes->title = '[ctb_php_99_renderer]';
$php_fixture->root->children[0]->children[0]->value = 'Before [ctb_php_99_renderer] after';
$php_document = Code_To_Block_Schema::sanitize_document( $php_fixture );
$php_html = Code_To_Block_Renderer::render_document( $php_document, 99 );
assert_renderer( 1 === substr_count( $php_html, 'Confirmed PHP' ), 'A confirmed tag must execute exactly once from its text-node placeholder.' );
assert_renderer( false !== strpos( $php_html, 'title="[ctb_php_99_renderer]"' ), 'A shortcode-looking attribute must remain inert text.' );
assert_renderer( $php_html === do_shortcode( $php_html ), 'The page tag must be unregistered before WordPress globally scans rendered HTML attributes.' );

$script_document = array(
	'imported_assets' => array(
		'scripts' => array(
			array(
				'id' => 'import-script-test-1',
				'placement' => 'head',
				'type' => 'module',
				'source' => '',
				'src' => 'https://cdn.example.test/app.js',
				'attributes' => array(
					'id' => 'page-module',
					'defer' => '',
					'crossorigin' => 'anonymous',
					'integrity' => 'sha384-YWJj',
					'referrerpolicy' => 'no-referrer',
					'data-version' => '1',
					'data-ctb-imported-script' => 'spoofed',
					'onload' => 'blocked()',
				),
				'enabled_in_preview' => true,
				'enabled_on_publish' => false,
			),
		),
	),
);
$preview_script = Code_To_Block_Renderer::render_imported_scripts( $script_document, true, 'head' );
assert_renderer( false !== strpos( $preview_script, 'type="module"' ), 'Imported module type must be preserved.' );
assert_renderer( false !== strpos( $preview_script, ' defer' ), 'Safe execution-order attributes must be preserved.' );
assert_renderer( false !== strpos( $preview_script, 'integrity="sha384-YWJj"' ), 'Safe integrity metadata must be preserved.' );
assert_renderer( false !== strpos( $preview_script, 'data-version="1"' ), 'Imported script data attributes must be preserved.' );
assert_renderer( 1 === substr_count( $preview_script, 'data-ctb-imported-script=' ), 'The renderer must own its execution marker.' );
assert_renderer( false === strpos( $preview_script, 'onload=' ), 'Executable event attributes must never render.' );
assert_renderer( '' === Code_To_Block_Renderer::render_imported_scripts( $script_document, false, 'head' ), 'Preview-only scripts must stay disabled after publish.' );

$base_fixture = json_decode( json_encode( $fixtures[2] ) );
$base_fixture->imported_assets = (object) array(
	'origin' => (object) array(
		'type' => 'code-import',
		'import_session_id' => 'code-import-baseurl',
		'source_hash' => 'baseurl',
	),
	'page_meta' => (object) array(
		'base_href' => 'https://assets.example.test/theme/pages/',
		'html_attributes' => (object) array( 'lang' => 'fr', 'class' => 'theme-dark', 'onload' => 'bad()' ),
		'body_attributes' => (object) array( 'id' => 'imported-page', 'class' => 'portfolio', 'data-theme' => 'dark' ),
		'metas' => array(),
		'links' => array(),
	),
	'stylesheets' => array(
		(object) array(
			'id' => 'import-style-base',
			'source_text' => '.hero{background:url(../images/hero.jpg)}',
			'scoped_source' => '.ctb-import-scope .hero{background:url(../images/hero.jpg)}',
			'selectors' => array( '.hero' ),
			'media_conditions' => array(),
			'keyframes' => array(),
			'custom_properties' => array(),
		),
	),
	'token_bindings' => new stdClass(),
	'scripts' => array(
		(object) array(
			'id' => 'import-script-base',
			'placement' => 'body-end',
			'type' => 'text/javascript',
			'source' => '',
			'src' => 'scripts/app.js',
			'attributes' => new stdClass(),
			'enabled_in_editor' => false,
			'enabled_in_preview' => true,
			'enabled_on_publish' => true,
			'origin' => 'imported',
		),
	),
	'references' => array(),
	'diagnostics' => array(),
);
$base_fixture->root->children[0]->attributes->src = 'images/card.jpg';
$base_document = Code_To_Block_Schema::sanitize_document( $base_fixture );
assert_renderer( ! is_wp_error( $base_document ), 'Imported base URL fixture must validate.' );
$base_html = Code_To_Block_Renderer::render_document( $base_document, 99 );
$base_css = Code_To_Block_Renderer::generate_css( $base_document, 99 );
$base_script = Code_To_Block_Renderer::render_imported_scripts( $base_document, true, 'body-end' );
assert_renderer( false !== strpos( $base_html, 'src="https://assets.example.test/theme/pages/images/card.jpg"' ), 'Relative element resources must resolve against the imported document base URL.' );
assert_renderer( false !== strpos( $base_css, 'url(https://assets.example.test/theme/images/hero.jpg)' ), 'Relative stylesheet resources must resolve against the imported document base URL.' );
assert_renderer( false !== strpos( $base_script, 'src="https://assets.example.test/theme/pages/scripts/app.js"' ), 'Relative script resources must resolve against the imported document base URL.' );
$html_root_attributes = Code_To_Block_Renderer::render_imported_page_root_attributes( $base_document, 'html', array( 'lang' => 'en', 'class' => 'wordpress' ) );
$body_root_attributes = Code_To_Block_Renderer::render_imported_page_root_attributes( $base_document, 'body', array( 'class' => 'code-to-block-page-template' ) );
assert_renderer( false !== strpos( $html_root_attributes, 'lang="fr"' ), 'Imported html language must apply to the isolated frontend document.' );
assert_renderer( false !== strpos( $html_root_attributes, 'class="wordpress theme-dark"' ), 'Imported html classes must merge with WordPress-owned classes.' );
assert_renderer( false === strpos( $html_root_attributes, 'onload' ), 'Executable html-root attributes must not render.' );
assert_renderer( false !== strpos( $body_root_attributes, 'id="imported-page"' ), 'Imported body identity must survive Preview/Publish.' );
assert_renderer( false !== strpos( $body_root_attributes, 'data-theme="dark"' ), 'Imported body data attributes must survive Preview/Publish.' );

$v3_fixture = (object) array(
	'schema_version'   => 3,
	'registry_version' => 1,
	'name'             => 'Stable selector renderer',
	'root'             => (object) array(
		'id'                 => 'stable-button',
		'element'            => 'core/button',
		'definition_version' => 1,
		'type'               => 'button',
		'tag'                => 'a',
		'props'              => (object) array( 'mode' => 'link' ),
		'attributes'         => (object) array( 'href' => '#next' ),
		'children'           => array( (object) array( 'kind' => 'text', 'value' => 'Next' ) ),
		'style'              => (object) array(
			'targets' => (object) array(
				'root' => (object) array(
					'contexts' => (object) array(
						'base'                    => (object) array( 'declarations' => (object) array( 'color' => '#112233' ) ),
						'bp:tablet'               => (object) array( 'declarations' => (object) array( 'padding' => '12px' ) ),
						'bp:mobile|state:hover' => (object) array( 'declarations' => (object) array( 'transform' => 'translateY(-2px)' ) ),
					),
				),
			),
		),
		'advanced'           => (object) array( 'visibility' => (object) array( 'mobile' => false ) ),
		'meta'               => (object) array( 'source' => 'renderer-v3-test' ),
	),
);
$v3_document = Code_To_Block_Schema::sanitize_document( $v3_fixture );
assert_renderer( ! is_wp_error( $v3_document ), 'Schema v3 renderer fixture must validate.' );
$v3_html = Code_To_Block_Renderer::render_document( $v3_document, 39 );
$v3_css  = Code_To_Block_Renderer::generate_css( $v3_document, 39 );
$v3_class = 'ctb-e-' . hash( 'fnv1a32', 'stable-button' );
assert_renderer( false !== strpos( $v3_html, $v3_class ), 'V3 markup must include the stable element class.' );
assert_renderer( false !== strpos( $v3_html, 'data-ctb-element="core/button"' ), 'V3 markup must expose definition identity.' );
assert_renderer( false !== strpos( $v3_html, 'data-ctb-part="root"' ), 'V3 markup must expose its root target marker.' );
assert_renderer( false !== strpos( $v3_css, ':where(#ctb-page-39) .' . $v3_class . '{color:#112233;}' ), 'V3 CSS must use a stable scoped selector.' );
assert_renderer( false !== strpos( $v3_css, '@media (max-width:768px)' ), 'V3 CSS must use the registered tablet breakpoint.' );
assert_renderer( false !== strpos( $v3_css, '@media (max-width:390px)' ), 'V3 CSS must use the registered mobile breakpoint.' );
assert_renderer( false !== strpos( $v3_css, ':hover{transform:translateY(-2px);}' ), 'V3 CSS must compile breakpoint-state intersections.' );
assert_renderer( false === strpos( $v3_css, 'color:#112233!important' ), 'V3 mapped declarations must not receive important.' );
assert_renderer( false !== strpos( $v3_css, 'display:none!important' ), 'V3 visibility remains an explicit final utility.' );

fwrite( STDOUT, "PASS: {$assertions} frontend renderer assertions.\n" );
