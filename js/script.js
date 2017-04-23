"use strict";

// 共通データ
var g_cmn = {
	cmn_param:	{											// 共通パラメータ
		font_family:		'',								// - フォント名
		font_size:			13,								// - フォントサイズ
		scroll_vertical:	1,								// - ページ全体のスクロールバー(縦)
		scroll_horizontal:	1,								// - ページ全体のスクロールバー(横)
		locale:				'ja',							// - 言語

		notify_sound_volume:1.0,							// - 音量

		tootkey:			0,								// - トゥートショートカットキー

		reload_time:		60,								// - 新着読み込み
		get_count:			40,								// - 一度に取得する件数
		max_count:			120,							// - タイムラインに表示する最大件数
		newscroll:			1,								// - 新着ツイートにスクロール
		follow_mark:		1,								// - 相互フォロー表示
		iconsize:			48,								// - アイコンサイズ
	},
	panel:			null,			// パネル
	account:		null,			// アカウント
	toolbar_user:	null,			// ツールバーに登録しているユーザ
	rss_panel:		null,			// RSSパネル

	account_order:	null,			// アカウントの並び順
	panellist_width: '200px',		// パネルリストの幅
	current_version: '',			// 現在のバージョン
};

// バックグラウンド開始済みフラグ
var g_bgstarted = false;

// データ読み込み完了フラグ
var g_loaded = false;

// 終了時データ保存
var g_saveend = true;

var g_testmode = true;

////////////////////////////////////////////////////////////////////////////////
// 初期化処理
////////////////////////////////////////////////////////////////////////////////
function Init()
{
	$( '#tooltip' ).hide();
	$( '#blackout' ).hide();
	$( '#messagebox' ).hide();

	g_cmn.panel = new Array();
	g_cmn.account = {};
	g_cmn.toolbar_user = new Array();
	g_cmn.notsave = {};
	g_cmn.account_order = new Array();
	g_cmn.rss_panel = {};

	$( document ).on( 'drop dragover', function( e ) {
		if ( e.target.tagName.match( /textarea/i ) || ( e.target.tagName.match( /input/i ) && e.target.type.match( /text/i ) ) )
		{
			if ( e.type == 'drop' && e.originalEvent.dataTransfer.files.length )
			{
				e.preventDefault();
				e.stopPropagation();
			}

			return true;
		}

		e.preventDefault();
		e.stopPropagation();
	} );

	// 言語ファイル設定
	SetLocaleFile();

	// ツールバー
	$( '#head' ).html( OutputTPL( 'header', {} ) );
	$( '#head' ).find( '.header_sub' ).hide();

	// パネルリスト
	$( '#panellist' ).resizable( {
		handles: 'e',
		minWidth: '16',
		stop: function() {
			g_cmn.panellist_width = $( '#panellist' ).css( 'width' );

			// パネルリストを被せない対応
			$( '#main' ).css( { position: 'absolute', left: g_cmn.panellist_width } );
		},
	} );

	// バージョン表示
	var manifest;

	$.ajax( {
		type: 'GET',
		url: 'manifest.json',
		data: {},
		dataType: 'json',
		async: false
	} ).done( function( data ) {
		manifest = data;

		$( '#main' ).append( '<div id="version"><a class="anchor" href="http://www.jstwi.com/kurotodon/" target="_blank">' +
			manifest.name + ' version ' + manifest.version + '</a></div>' );
	} );

	// Activity Indicator dummy
	$.fn.activity = function( opts ) {
		if ( opts == false )
		{
			$( '#loading' ).hide();
		}
		else
		{
			$( '#loading' ).show();
		}
	};

	////////////////////////////////////////////////////////////
	// 保存データを読み込み、アカウント、パネルを復元する
	////////////////////////////////////////////////////////////
	var LoadData = function() {
		// バックグラウンドに開始を伝える
		SendRequest(
			{
				action: 'start_routine',
			},
			function( res )
			{
				// localStorageからデータ読み込み
				var text = getUserInfo( 'g_cmn_V1' );

				if ( text != '' )
				{
					text = decodeURIComponent( text );
					var _g_cmn = JSON.parse( text );

					// 共通パラメータの復元
					for ( var p in _g_cmn.cmn_param )
					{
						// 削除されたパラメータは無視
						if ( g_cmn.cmn_param[p] == undefined )
						{
							continue;
						}

						g_cmn.cmn_param[p] = _g_cmn.cmn_param[p];
					}

					// フォントサイズ
					SetFont();

					// ページ全体のスクロールバー
					$( 'body' ).css( { 'overflow-y': ( g_cmn.cmn_param['scroll_vertical'] == 1 ) ? 'auto' : 'hidden' } );
					$( 'body' ).css( { 'overflow-x': ( g_cmn.cmn_param['scroll_horizontal'] == 1 ) ? 'auto' : 'hidden' } );

					////////////////////////////////////////
					// 後続処理
					// （アカウントの復元後に実行する）
					////////////////////////////////////////
					var Subsequent = function() {
						// ツールバーユーザの復元
						if ( _g_cmn.toolbar_user != undefined )
						{
							g_cmn.toolbar_user = _g_cmn.toolbar_user;
						}

						UpdateToolbarUser();

						// RSSパネルの復元
						if ( _g_cmn.rss_panel != undefined )
						{
							g_cmn.rss_panel = _g_cmn.rss_panel;
						}

						// アカウントの並び順
						if ( _g_cmn.account_order != undefined )
						{
							g_cmn.account_order = _g_cmn.account_order;

							// 削除されているアカウントを取り除く
							for ( var i = 0, _len = g_cmn.account_order.length ; i < _len ; i++ )
							{
								if ( g_cmn.account[g_cmn.account_order[i]] == undefined )
								{
									g_cmn.account_order.splice( i, 1 );
									i--;
								}
							}
						}
						else
						{
							for ( var id in g_cmn.account )
							{
								g_cmn.account_order.push( id.toString() );
							}
						}

						// パネルリストの幅
						if ( _g_cmn.panellist_width != undefined )
						{
							 g_cmn.panellist_width = _g_cmn.panellist_width;
						}

						// 現在のバージョン
						if ( _g_cmn.current_version != undefined )
						{
							 g_cmn.current_version = _g_cmn.current_version;
						}

						if ( g_cmn.current_version != '' )
						{
							if ( g_cmn.current_version != manifest.version )
							{
								MessageBox( i18nGetMessage( 'i18n_0345', [g_cmn.current_version, manifest.version] ) +
									'<br><br>' +
									'<a class="anchor" href="http://www.jstwi.com/kurotodon/update.html" target="_blank">http://www.jstwi.com/kurotodon/update.html</a>',
									5 * 1000 );
							}
						}

						g_cmn.current_version = manifest.version;

						// パネルの復元
						var cp;

						for ( var i = 0, _len = _g_cmn.panel.length ; i < _len ; i++ )
						{
							cp = new CPanel( _g_cmn.panel[i].x, _g_cmn.panel[i].y,
											 _g_cmn.panel[i].w, _g_cmn.panel[i].h,
											 _g_cmn.panel[i].id.replace( /^panel_/, '' ),
											 _g_cmn.panel[i].minimum,
											 _g_cmn.panel[i].zindex,
											 _g_cmn.panel[i].status,
											 true );

							if ( _g_cmn.panel[i].type == null )
							{
								continue;
							}

							cp.SetType( _g_cmn.panel[i].type );
							cp.SetTitle( _g_cmn.panel[i].title, _g_cmn.panel[i].setting );
							cp.SetParam( _g_cmn.panel[i].param );
							cp.Start();
						}

						g_loaded = true;
					};

					// アカウントの復元
					var _cnt = 0;
					var _comp = 0;
					var account_order = [];

					for ( var id in _g_cmn.account )
					{
						_cnt++;
						account_order.push( id );
					}

					// アカウント情報なし
					if ( _cnt == 0 )
					{
						// 後続処理を実行
						Blackout( false );
						$( '#blackout' ).activity( false );
						Subsequent();
					}
					// アカウント情報あり
					else
					{
						var _comp = 0;

						// アカウント情報を更新
						Blackout( true );
						$( '#blackout' ).activity( { color: '#ffffff' } );

						function GetAccountInfo()
						{
							var account_id = account_order[_comp];

							// アカウント情報初期設定値
							g_cmn.account[account_id] = {
								client_id: '',
								client_secret: '',
								instance: '',
								access_token: '',
								id: '',
								username: '',
								display_name: '',
								avatar: '',
								notsave: {},
							};

							for ( var p in _g_cmn.account[account_id] )
							{
								// 削除されたパラメータは無視
								if ( g_cmn.account[account_id][p] == undefined )
								{
									continue;
								}

								g_cmn.account[account_id][p] = _g_cmn.account[account_id][p];
							}

							$( '#blackout' ).append( OutputTPL( 'blackoutinfo', {
								id: 'info0_' + _comp,
								msg: i18nGetMessage( 'i18n_0046' ) + '(' + g_cmn.account[account_id]['display_name'] +
									 '@' + g_cmn.account[account_id]['instance'] + ')' } ) );

							SendRequest(
								{
									action: 'api_call',
									instance: g_cmn.account[account_id].instance,
									api: 'accounts/verify_credentials',
									access_token: g_cmn.account[account_id].access_token,
								},
								function( res )
								{
									if ( !res.status )
									{
										g_cmn.account[account_id].username = res.username;
										g_cmn.account[account_id].display_name = res.display_name;
										g_cmn.account[account_id].avatar = res.avatar;
										g_cmn.account[account_id].notsave.statuses_count = res.statuses_count;
										g_cmn.account[account_id].notsave.following_count = res.following_count;
										g_cmn.account[account_id].notsave.followers_count = res.followers_count;
									}
									else
									{
										ApiError( res );
									}

									$( '#info0_' + _comp ).append( ' ... completed' ).fadeOut( 'slow', function() { $( this ).remove() } );
									_comp++;

									if ( _comp >= _cnt )
									{
										var _next = function() {
											if ( $( '#blackout' ).find( 'div.info' ).length == 0 )
											{
												Blackout( false );
												$( '#blackout' ).activity( false );
												Subsequent();
												$( '#head' ).trigger( 'account_update' );
											}
											else
											{
												setTimeout( function() { _next(); }, 100 );
											}
										};

										_next();
									}
									else
									{
										GetAccountInfo();
									}
								}
							);
						}
						
						GetAccountInfo();
					}
				}
				else
				{
					g_loaded = true;

					// 初回起動

					// フォントサイズ
					SetFont();

					// アカウント画面を開く
					Blackout( false );
					$( '#blackout' ).activity( false );
					$( '#head_account' ).trigger( 'click' );
				}

				// 設定/状態保存の定期実行
				var AutoSave = function() {
					SaveData();

					setTimeout( AutoSave, 30 * 1000 );
				};

				setTimeout( AutoSave, 30 * 1000 );
			}
		);
	};

	var current_tab;

	// カレントタブを取得
	chrome.tabs.getCurrent( function( tab ) {
		current_tab = tab;

		// 全タブを取得して起動中ならそこにフォーカス移動＆このタブは消す
		chrome.windows.getAll( { populate: true }, function( wins ) {
			var tab = null;

			Blackout( true );
			$( '#blackout' ).activity( { color: '#808080', width: 8, length: 14 } );

			for ( var wi = 0, _len = wins.length ; wi < _len ; wi++ )
			{
				for ( var ti = 0, __len = wins[wi].tabs.length ; ti < __len ; ti++ )
				{
					if ( wins[wi].tabs[ti].url.match( /^chrome-extension:\/\// ) &&
						 wins[wi].tabs[ti].title == 'Kurotodon' )
					{
						// 多重
						if ( wins[wi].tabs[ti].id != current_tab.id )
						{
							chrome.windows.update( wins[wi].id, { focused: true } );
							chrome.tabs.update( wins[wi].tabs[ti].id, { selected: true } );
							chrome.tabs.remove( current_tab.id );
							$( '#blackout' ).activity( false );
							return;
						}
						// カレント
						else
						{
							tab = wins[wi].tabs[ti];
						}
					}
				}
			}

			if ( tab == null )
			{
				$( '#blackout' ).activity( false );
				return;
			}

			// バックグラウンドの変数にアプリを開いているタブ、manifest.jsonを設定
			g_bgstarted = true;
			chrome.extension.getBackgroundPage().app_tab = tab;
			chrome.extension.getBackgroundPage().app_manifest = manifest;

			// バックグラウンドとの通信用
			SetBackgroundConnect();

			LoadData();
		} );
	} );

	////////////////////////////////////////////////////////////
	// ツールボタンのクリック処理
	////////////////////////////////////////////////////////////
	$( '#head_tool' ).click( function( e ) {
		// disabledなら処理しない
		if ( $( this ).hasClass( 'disabled' ) )
		{
			return;
		}

		$( '#head_tool_sub' ).toggle()
			.css( { left: 0, top: $( this ).outerHeight() } );
	} );

	////////////////////////////////////////////////////////////
	// ツールメニューのクリック処理
	////////////////////////////////////////////////////////////
	$( '#head_tool_sub' ).click( function( e ) {
		switch ( $( e.target ).index() )
		{
			// RSSパネル一覧
			case 0:
				var pid = IsUnique( 'rsslist' );

				if ( pid == null )
				{
					var _cp = new CPanel( null, null, 320, 360 );
					_cp.SetType( 'rsslist' );
					_cp.SetTitle( i18nGetMessage( 'i18n_0032' ), false );
					_cp.SetParam( {} );
					_cp.Start();
				}
				else
				{
					SetFront( $( '#' + pid ) );

					// 最小化している場合は元に戻す
					if ( GetPanel( pid ).minimum.minimum == true )
					{
						$( '#' + pid ).find( 'div.titlebar' ).find( '.minimum' ).trigger( 'click' );
					}
				}

				break;
			// Now Browsing
			case 1:
				var pid = IsUnique( 'nowbrowsing' );

				if ( pid == null )
				{
					var _cp = new CPanel( null, null, 360, 240 );
					_cp.SetType( 'nowbrowsing' );
					_cp.SetTitle( i18nGetMessage( 'i18n_0029' ), false );
					_cp.SetParam( {} );
					_cp.Start();
				}
				else
				{
					SetFront( $( '#' + pid ) );

					// 最小化している場合は元に戻す
					if ( GetPanel( pid ).minimum.minimum == true )
					{
						$( '#' + pid ).find( 'div.titlebar' ).find( '.minimum' ).trigger( 'click' );
					}
				}

				break;
			// インポート/エクスポート
			case 2:
				var pid = IsUnique( 'impexp' );

				if ( pid == null )
				{
					var _cp = new CPanel( null, null, 360, 240 );
					_cp.SetType( 'impexp' );
					_cp.SetTitle( i18nGetMessage( 'i18n_0052' ) + '/' + i18nGetMessage( 'i18n_0053' ), false );
					_cp.SetParam( {} );
					_cp.Start();
				}
				else
				{
					SetFront( $( '#' + pid ) );

					// 最小化している場合は元に戻す
					if ( GetPanel( pid ).minimum.minimum == true )
					{
						$( '#' + pid ).find( 'titlebar' ).find( '.minimum' ).trigger( 'click' );
					}
				}

				break;
		}

		$( this ).toggle();
	} );

	////////////////////////////////////////////////////////////
	// 検索ボタンのクリック処理
	////////////////////////////////////////////////////////////
	$( '#head_search' ).click( function( e ) {
		// disabledなら処理しない
		if ( $( this ).hasClass( 'disabled' ) )
		{
			return;
		}

		var pid = IsUnique( 'searchbox' );

		if ( pid == null )
		{
			var _cp = new CPanel( null, null, 320, 140 );
			_cp.SetType( 'searchbox' );
			_cp.SetTitle( i18nGetMessage( 'i18n_0206' ), false );
			_cp.SetParam( { account_id: '', } );
			_cp.Start();
		}
		else
		{
			SetFront( $( '#' + pid ) );

			// 最小化している場合は元に戻す
			if ( GetPanel( pid ).minimum.minimum == true )
			{
				$( '#' + pid ).find( 'div.titlebar' ).find( '.minimum' ).trigger( 'click' );
			}

			$( '#searchbox_text' ).focus();
		}
	});

	////////////////////////////////////////////////////////////
	// ツイートボタンのクリック処理
	////////////////////////////////////////////////////////////
	$( '#head_tweet' ).click( function( e ) {
		// disabledなら処理しない
		if ( $( this ).hasClass( 'disabled' ) )
		{
			return;
		}

		var pid = IsUnique( 'tweetbox' );
		var left = null;
		var top = null;
		var width = 324;

		if ( pid != null )
		{
			SetFront( $( '#' + pid ) );

			// 最小化している場合は元に戻す
			if ( GetPanel( pid ).minimum.minimum == true )
			{
				$( '#' + pid ).find( 'div.titlebar' ).find( '.minimum' ).trigger( 'click' );
			}

			$( '#tweetbox_text' ).focus();
		}

		if ( pid == null )
		{
			var _cp = new CPanel( left, top, width, 240 );
			_cp.SetType( 'tweetbox' );
			_cp.SetTitle( i18nGetMessage( 'i18n_0367' ), false );
			_cp.SetParam( { account_id: '', rep_user: null, hashtag: null, maxlen: 140, } );
			_cp.Start();
		}
	});

	////////////////////////////////////////////////////////////
	// アカウントボタンのクリック処理
	////////////////////////////////////////////////////////////
	$( '#head_account' ).click( function( e ) {
		var pid = IsUnique( 'account' );

		if ( pid == null )
		{
			var _cp = new CPanel( null, null, 360, 240 );
			_cp.SetType( 'account' );
			_cp.SetTitle( i18nGetMessage( 'i18n_0044' ), false );
			_cp.SetParam( {} );
			_cp.Start();
		}
		else
		{
			SetFront( $( '#' + pid ) );

			// 最小化している場合は元に戻す
			if ( GetPanel( pid ).minimum.minimum == true )
			{
				$( '#' + pid ).find( 'div.titlebar' ).find( '.minimum' ).trigger( 'click' );
			}
		}
	});

	////////////////////////////////////////////////////////////
	// 設定ボタンのクリック処理
	////////////////////////////////////////////////////////////
	$( '#head_setting' ).click( function( e ) {
		var pid = IsUnique( 'cmnsetting' );

		if ( pid == null )
		{
			var _cp = new CPanel( null, null, 360, 360 );
			_cp.SetType( 'cmnsetting' );
			_cp.SetTitle( i18nGetMessage( 'i18n_0242' ), false );
			_cp.SetParam( {} );
			_cp.Start();
		}
		else
		{
			SetFront( $( '#' + pid ) );

			// 最小化している場合は元に戻す
			if ( GetPanel( pid ).minimum.minimum == true )
			{
				$( '#' + pid ).find( 'div.titlebar' ).find( '.minimum' ).trigger( 'click' );
			}
		}
	});

	////////////////////////////////////////////////////////////
	// アカウント数変更時の処理
	////////////////////////////////////////////////////////////
	$( '#head' ).on( 'account_update', function()
		{
			// ツイート、検索ボタンの有効/無効
			if ( AccountCount() > 0 )
			{
				$( '#head_search' ).removeClass( 'disabled' );
				$( '#head_tweet' ).removeClass( 'disabled' );
			}
			else
			{
				$( '#head_search' ).addClass( 'disabled' );
				$( '#head_tweet' ).addClass( 'disabled' );
			}

			// 各パネルの処理を呼ぶ
			$( 'panel' ).find( 'div.contents' ).trigger( 'account_update' );
		}
	);

	////////////////////////////////////////////////////////////////////////////////
	// パネルリスト表示
	////////////////////////////////////////////////////////////////////////////////
	$( '#head_panellist' ).on( 'click', function() {
		if ( $( '#panellist' ).css( 'display' ) == 'none' )
		{
			// パネルリストを被せない対応
			$( '#main' ).css( { position: 'absolute' } ).animate( { left: g_cmn.panellist_width }, 200 );

			$( '#panellist' ).css( { display: 'block', top: $( '#head' ).outerHeight() } ).animate( { width: g_cmn.panellist_width }, 200 );
		}
		else
		{
			// パネルリストを被せない対応
			$( '#main' ).animate( { left: 0 }, 400 ).css( { position: 'relative' } );

			$( '#panellist' ).animate( { width: 0 }, 200, function() { $( '#panellist' ).css( { display: 'none' } ) } );
		}
	} );

	////////////////////////////////////////////////////////////
	// キーボードショートカット
	////////////////////////////////////////////////////////////
	$( window ).keydown( function( e ) {
		// altを押していない場合は無視
		if ( e.altKey != true )
		{
			return;
		}

		// ブラックアウト中は無効
		if ( $( '#blackout' ).css( 'display' ) != 'none' )
		{
			return;
		}

		var INITIAL_ELEMENT_ID = ''
		var element_id = INITIAL_ELEMENT_ID
		switch ( e.keyCode )
		{
			// alt+'w'でツイートパネル
			case 87:
				element_id = '#head_tweet'
				break;
			// alt+'s'で検索パネル
			case 83:
				element_id = '#head_search'
				break;
			// alt+'a'でアカウントパネル
			case 65:
			  element_id = '#head_account'
				break;
			// alt+'p'でパネルリスト
			case 80:
			  element_id = '#head_panellist'
				break;
			default:
			  return;
		}

		if ( element_id == INITIAL_ELEMENT_ID )
		{
			return;
		}

		// Macでalt+<character>は別の文字列になり、フォーカスが移った後にその文字が入力さ
		// れてしまうのでデフォルト動作を無効化
		// e.g. alt+'w' = ∑
		e.preventDefault();
		$( element_id ).trigger( 'click' );
	} );
}

////////////////////////////////////////////////////////////////////////////////
// 終了処理
////////////////////////////////////////////////////////////////////////////////
window.onunload = window.onbeforeunload = function( e ) {
	// 全コンテンツの終了処理を実行
	for ( var i = 0, _len = g_cmn.panel.length ; i < _len ; i++ )
	{
		if ( g_cmn.panel[i].type != null )
		{
			g_cmn.panel[i].contents.stop();
		}
	}

	// バックグラウンドに終了を伝える
	if ( g_bgstarted == true )
	{
		SendRequest(
			{
				action: 'exit_routine',
			},
			function( res )
			{
			}
		);
	}

	if ( !g_saveend )
	{
		return;
	}

	// データ読み込みが完了していない場合
	if ( g_loaded == false )
	{
		// データの上書きをしない
		return;
	}

	SaveData();

	g_saveend = false;
};

////////////////////////////////////////////////////////////////////////////////
// ツールチップ表示
////////////////////////////////////////////////////////////////////////////////
$( document ).on( 'mouseenter mouseleave', '.tooltip', function( e ) {
	if ( e.type == 'mouseenter' )
	{
		var tip = $( this ).attr( 'tooltip' );

		if ( tip == undefined )
		{
			return;
		}

		$( '#tooltip' ).css( { left: 0, top: 0, width: 'auto' } ).text( tip );

		var l, t, w;
		l = $( this ).offset().left + $( this ).outerWidth( true );
		t = $( this ).offset().top + 2;
		w = $( '#tooltip' ).outerWidth( true );

		// 画面外にでないように調整
		if ( l + $( '#tooltip' ).outerWidth( true ) + 8 > $( window ).width() + $( document ).scrollLeft() )
		{
			l = $( window ).width() - $( '#tooltip' ).outerWidth( true ) - 8 + $( document ).scrollLeft();
			t = $( this ).offset().top + $( this ).outerHeight() + 2;
		}

		$( '#tooltip' ).css( { top: t, left: l, width: w } ).show();
	}
	else
	{
		$( '#tooltip' ).hide();
	}
});

////////////////////////////////////////////////////////////////////////////////
// ブラックアウト
////////////////////////////////////////////////////////////////////////////////
function Blackout( flg, special )
{
	if ( special == false )
	{
		return;
	}

	if ( flg )
	{
		$( '#blackout' ).show();
	}
	else
	{
		$( '#blackout' ).hide();
	}
}

////////////////////////////////////////////////////////////////////////////////
// ユニークコンテンツチェック
// ret)
//  null     ... 開かれていない
//  パネルID ... 開かれている
////////////////////////////////////////////////////////////////////////////////
function IsUnique( type )
{
	for ( var i = 0, _len = g_cmn.panel.length ; i < _len ; i++ )
	{
		if ( g_cmn.panel[i].type == type )
		{
			return g_cmn.panel[i].id;
		}
	}

	return null;
}

////////////////////////////////////////////////////////////////////////////////
// 指定したパネルIDのパネルオブジェクトを返す
////////////////////////////////////////////////////////////////////////////////
function GetPanel( panelid )
{
	for ( var i = 0, _len = g_cmn.panel.length ; i < _len ; i++ )
	{
		if ( g_cmn.panel[i].id == panelid )
		{
			return g_cmn.panel[i];
		}
	}

	return null;
}

////////////////////////////////////////////////////////////////////////////////
// データを保存する
////////////////////////////////////////////////////////////////////////////////
function SaveData()
{
	if ( g_loaded )
	{
		setUserInfo( 'g_cmn_V1', SaveDataText() );
	}
}

////////////////////////////////////////////////////////////////////////////////
// テンプレート出力
////////////////////////////////////////////////////////////////////////////////
var tpl_c = {};

function OutputTPL( name, assign )
{
	if ( tpl_c[name] == null || tpl_c[name] == undefined )
	{
		$.ajax( {
			type: 'GET',
			url: 'template/' + name + '.tpl',
			data: {},
			dataType: 'html',
			async: false
		} ).done( function( data ) {
			// 国際化対応
			data = data.replace( /\t/g, '' );

			var i18ns = data.match( /\(i18n_.+?\)/g );

			if ( i18ns )
			{
				for ( var i = 0, _len = i18ns.length ; i < _len ; i++ )
				{
					data = data.replace( i18ns[i], i18nGetMessage( i18ns[i].replace( /\W/g, "" ) ) );
				}
			}

			tpl_c[name] = new jSmart( data );
		} );
	}
	return tpl_c[name].fetch( assign );
}

////////////////////////////////////////////////////////////////////////////////
// アカウント数取得
////////////////////////////////////////////////////////////////////////////////
function AccountCount()
{
	return g_cmn.account_order.length;
}

////////////////////////////////////////////////////////////////////////////////
// 登録しているアカウントかチェック
////////////////////////////////////////////////////////////////////////////////
function IsMyAccount( user_id )
{
	for ( var id in g_cmn.account )
	{
		if ( id == user_id )
		{
			return id;
		}
	}

	return false;
}

////////////////////////////////////////////////////////////////////////////////
// 指定したパネルにアカウント選択ボックスを作成
////////////////////////////////////////////////////////////////////////////////
function AccountSelectMake( cp )
{
	var p = $( '#' + cp.id );
	var cont = p.find( 'div.contents' );

	// アカウント未選択/指定されたアカウントが存在しない場合
	if ( cp.param.account_id == '' || g_cmn.account[cp.param['account_id']] == undefined )
	{
		// 先頭のアカウントを自動選択
		if ( g_cmn.account_order.length > 0 )
		{
			cp.param['account_id'] = g_cmn.account_order[0];
		}
	}

	// 選択したアカウント部
	var item = {
		id: cp.param['account_id'],
		icon: g_cmn.account[cp.param['account_id']].icon,
		name: g_cmn.account[cp.param['account_id']].display_name,
	};

	var account_select = cont.find( '.account_select' );

	account_select.html( OutputTPL( 'account_select', { item: item } ) );

	account_select.find( '.selectitem' ).click(
		function()
		{
			account_select.find( '.selectlist' ).slideToggle( 200, function() {
				account_select.find( '.selectlist' ).scrollTop( account_select.find( '.selectlist' ).find( '.item.select' ).position().top );
			} );
		}
	);

	// アカウント一覧部
	var selectlist = account_select.find( '.selectlist' );

	var items = new Array();
	var id;

	for ( var i = 0, _len = g_cmn.account_order.length ; i < _len ; i++ )
	{
		id = g_cmn.account_order[i];

		items.push( {
			name: g_cmn.account[id]['display_name'],
			icon: g_cmn.account[id]['icon'],
			id: id,
		} );
	}

	var assign = {
		items: items,
	};

	selectlist.html( OutputTPL( 'account_select_list', assign ) );

	selectlist.find( '.item' ).each( function() {
		if ( $( this ).attr( 'account_id' ) == cp.param['account_id'] )
		{
			$( this ).addClass( 'select' );
			return false;
		}
	} );

	////////////////////////////////////////////////////////////
	// クリック時処理
	////////////////////////////////////////////////////////////
	selectlist.find( '.item' ).click( function( e ) {
		cp.param['account_id'] = $( this ).attr( 'account_id' );

		selectlist.slideToggle( 100, function() {
			AccountSelectMake( cp );
			cont.trigger( 'account_changed' );
		} );

		e.stopPropagation();
	} );

	selectlist.hide();
}

////////////////////////////////////////////////////////////////////////////////
// フォント設定
////////////////////////////////////////////////////////////////////////////////
function SetFont( formflg )
{
g_cmn.cmn_param.font_family ='Meiryo';
g_cmn.cmn_param.font_size =12;
	if ( !formflg )
	{
		$( 'html,body' ).css( { fontSize: g_cmn.cmn_param.font_size + 'px', fontFamily: g_cmn.cmn_param.font_family } );
	}

	$( 'input[type=text]' ).css( { fontSize: g_cmn.cmn_param.font_size + 'px' } );
	$( 'input[type=password]' ).css( { fontSize: g_cmn.cmn_param.font_size + 'px' } );
	$( 'input[type=file]' ).css( { fontSize: g_cmn.cmn_param.font_size + 'px' } );
	$( 'textarea' ).css( { fontSize: g_cmn.cmn_param.font_size + 'px' } );
	$( 'select' ).css( { fontSize: g_cmn.cmn_param.font_size + 'px' } );
}

////////////////////////////////////////////////////////////////////////////////
// 指定したパネルを一番上に持ってくる
////////////////////////////////////////////////////////////////////////////////
function SetFront( p )
{
	var pzindex = p[0].style.zIndex;

	$( 'panel' ).each( function() {
		var zindex = $( this )[0].style.zIndex;

		if ( zindex > pzindex )
		{
			$( this ).css( 'zIndex', zindex - 1 );
		}
	} );

	p.css( 'zIndex', 100 + g_cmn.panel.length - 1 );
}


////////////////////////////////////////////////////////////////////////////////
// タイムライン作成
////////////////////////////////////////////////////////////////////////////////
function MakeTimeline( json, account_id )
{
	var text = json.content;

	var bt_flg = ( json.reblog );
	var bt_user_id = json.account.id;
	var bt_user_instance = GetInstanceFromAcct( json.account.acct, account_id );
	var bt_user_display_name = json.account.display_name;
	var bt_avatar = AvatarURLConvert( json.account, account_id );

	if ( bt_flg )
	{
		var _json = json.reblog;
		json = _json;
	}

	var user_instance = GetInstanceFromAcct( json.account.acct, account_id );

	// 相互、一方フォローマーク
	var isfriend = IsFriend( account_id, json.account.id, user_instance );
	var isfollower = IsFollower( account_id, json.account.id, user_instance );

	var assign = {
		user_id: json.account.id,
		user_instance: '仮',
		status_id: json.id,
		created_at: json.created_at,

		user_avatar: AvatarURLConvert( json.account, account_id ),
		statuses_count: json.account.statuses_count,
		following: json.account.following_count,
		followers: json.account.followers_count,

		bt_flg: bt_flg,

		bt_user_id: bt_user_id,
		bt_user_instance: bt_user_instance,
		bt_user_display_name: bt_user_display_name,
		bt_avatar: bt_avatar,

		user_display_name: json.account.display_name,
		user_username: json.account.username,
		user_instance: user_instance,

		isfriend: isfriend,
		isfollower: isfollower,

		btcnt: json.reblogs_count,
		favcnt: json.favourites_count,

		date: DateConv( json.created_at, 0 ),
		dispdate: DateConv( json.created_at, 3 ),

		source: ( user_instance == g_cmn.account[account_id].instance ) ? '' : '@' + user_instance,
		
		text: ConvertContent( json.content, json ),
	};

	return OutputTPL( 'timeline_tweet', assign );
}


////////////////////////////////////////////////////////////////////////////////
// アイコンをドラッグできるようにする
////////////////////////////////////////////////////////////////////////////////
function SetDraggable( selector, p, cp )
{
	selector.draggable( {
		containment: 'document',
		opacity: 0.8,
		start: function() {
			$( '#main' ).addClass( 'dragon' );
			$( '#head' ).addClass( 'dragon' );

			var item = $( this ).parent().parent();

			if ( cp != null )
			{
				SetFront( p );
				$( this ).addClass( 'fromtl' );
			}

			$( this ).addClass( 'dropitem user' )
				.attr( {
					account_id: ( cp != null ) ? cp.param['account_id'] : null,
					id: item.attr( 'id' ),
					instance: item.attr( 'instance' ),
					display_name: item.attr( 'display_name' ),
					avatar: $( this ).attr( 'avatar' ),
					created_at: item.attr( 'created_at' ),
					type: ( item.attr( 'type' ) ) ? item.attr( 'type' ) : 'user',
				} );

			if ( !item.attr( 'drag_id' ) )
			{
				item.attr( 'drag_id', GetUniqueID() );
			}

			$( '#head_users' ).attr( 'currentdrag', item.attr( 'drag_id' ) );

			$( 'body' ).css( { pointerEvents: 'none' } );
		},
		stop: function( e, ui ) {
			$( '#main' ).removeClass( 'dragon' );
			$( '#head' ).removeClass( 'dragon' );

			$( this ).removeClass( 'dropitem user' );

			$( 'body' ).css( { pointerEvents: 'auto' } );

			var dropuser;
			var dropuseridx = 0;

			// ツールバーから
			if ( !$( this ).hasClass( 'fromtl' ) )
			{
				var idx = $( '#head_users' ).find( '>div[drag_id="' + $( '#head_users' ).attr( 'currentdrag' ) + '"]' ).index();

				dropuser = g_cmn.toolbar_user[idx];
				g_cmn.toolbar_user.splice( idx, 1 );
				dropuseridx = idx;
			}
			// TLから
			else
			{
				if ( IsToolbarUser( $( this ).attr( 'id' ) ) == -1 )
				{
					dropuser = {
						id: $( this ).attr( 'id' ),
						instance: $( this ).attr( 'instance' ),
						display_name: $( this ).attr( 'display_name' ),
						avatar: $( this ).attr( 'avatar' ),
						account_id: $( this ).attr( 'account_id' ),
						created_at: $( this ).attr( 'created_at' ),
						type: $( this ).attr( 'type' ),
					};
				}
				else
				{
					$( '#head_users' ).removeAttr( 'currentdrag' );
					$( '#head_users div' ).removeClass( 'iconover' );
					return;
				}
			}

			// 情報を挿入する
			var insflg = false;

			$( '#head_users > div' ).each( function() {
				if ( $( this ).hasClass( 'iconover' ) )
				{
					// 右端
					if ( $( this ).hasClass( 'dmy' ) )
					{
						g_cmn.toolbar_user.push( dropuser );
						insflg = true;
					}
					else
					{
						for ( var i = 0, _len = g_cmn.toolbar_user.length ; i < _len ; i++ )
						{
							if ( ( g_cmn.toolbar_user[i].type == 'user' && g_cmn.toolbar_user[i].user_id == $( this ).attr( 'user_id' ) ) )
							{
								g_cmn.toolbar_user.splice( i, 0, dropuser );
								insflg = true;
								break;
							}
						}
					}

					return false;
				}
			} );

			if ( !insflg )
			{
				// TLから
				if ( $( this ).hasClass( 'fromtl' ) )
				{
					var l = ui.offset.left - $( document ).scrollLeft() ;
					var t = ui.offset.top - $( document ).scrollTop();
					var head = $( '#head' );
					var hl = head.position().left;
					var ht = head.position().top;
					var hw = head.outerWidth();
					var hh = head.outerHeight();

					if ( l >= hl && l <= hl + hw && t >= ht && t <= ht + hh )
					{
						g_cmn.toolbar_user.push( dropuser );
					}
				}
				// ツールバーから
				else
				{
					g_cmn.toolbar_user.splice( dropuseridx, 0, dropuser );
				}
			}

			$( '#head_users' ).removeAttr( 'currentdrag' );
			UpdateToolbarUser();

			$( '#head_users div' ).removeClass( 'iconover' );
		},
		drag: function( e, ui ) {
			var l = ui.offset.left - $( document ).scrollLeft();
			var t = ui.offset.top - $( document ).scrollTop();
			var head = $( '#head' );
			var hl = head.position().left;
			var ht = head.position().top;
			var hw = head.outerWidth();
			var hh = head.outerHeight();

			if ( l >= hl && l <= hl + hw && t >= ht && t <= ht + hh )
			{
				$( '#head_users > div' )
					.removeClass( 'iconover' )
					.each( function() {
						var dl = $( this ).position().left;
						var dt = $( this ).position().top;
						var dw = $( this ).outerWidth();
						var dh = $( this ).outerHeight();
						var id = $( this ).attr( 'drag_id' );

						if ( l >= dl - dw / 2 && l < dl + dw - dw / 2 && t >= dt && t <= dt + dh && $( '#head_users' ).attr( 'currentdrag' ) != id )
						{
							$( this ).addClass( 'iconover' );
							return false;
						}
					} );
			}
		},

		appendTo: 'body',
		zIndex: 2000,
		helper: 'clone',
	} );
}


////////////////////////////////////////////////////////////////////////////////
// テキストエリアのカーソル位置設定
////////////////////////////////////////////////////////////////////////////////
$.fn.extend( {
	SetPos: function( pos ) {
		var elem = this.get( 0 );

		if ( pos == 'start' )
		{
			pos = 0;
		}
		else if ( pos == 'end' )
		{
			pos = elem.value.length;
		}

		if ( elem != undefined )
		{
			elem.focus();

			if ( elem.createTextRange )
			{
				var range = elem.createTextRange();
				range.move( 'character', pos );
				range.select();
			}
			else if ( elem.setSelectionRange )
			{
				elem.setSelectionRange( pos, pos );
			}
		}
	}
} );


////////////////////////////////////////////////////////////////////////////////
// メッセージ出力
////////////////////////////////////////////////////////////////////////////////
var messages = new Array();

function MessageBox( msg, time )
{
	var MessageUpdate = function() {
		for ( var i = 0, s = '', _len = messages.length ; i < _len ; i++ )
		{
			s += messages[i].msg;
		}

		if ( s == '' )
		{
			$( '#messagebox' ).css( 'visibility', 'hidden' );
		}
		else
		{
			$( '#messagebox_body' ).html( s );
		}
	};

	msg = '<div><div class="msg">' + msg.replace( /\n/g, '<br>' ) + '</div></div>';

	messages.push( {
		msg: msg,
		tm: setTimeout( function() {
			messages.splice( 0, 1 );
			MessageUpdate();
		}, ( time ) ? time : 20 * 1000 ),
	} );

	// 初回表示
	if ( $( '#messagebox' ).css( 'display' ) == 'none' )
	{
		$( '#messagebox' ).show()
			.draggable( {
				cursor: 'move',
			} )
			.html( OutputTPL( 'messagebox', {} ) );

		var w = $( '#messagebox' ).outerWidth();
		var h = $( '#messagebox' ).outerHeight();

		$( '#messagebox' ).css( {
			left: ( $( '#main' ).width() - w ) / 2,
			top: ( $( '#main' ).height() - h ) / 2 - $( '#head' ).height(),
		} );

		$( '#messagebox_foot' ).find( '.btn' ).click( function( e ) {
			$( '#messagebox' ).css( 'visibility', 'hidden' );

			// メッセージをクリア
			for ( var i = 0, _len = messages.length ; i < _len ; i++ )
			{
				clearTimeout( messages[i].tm );
			}

			messages = [];

			MessageUpdate();

			e.stopPropagation();
		} );
	}
	// 2回目以降表示
	{
		$( '#messagebox' ).css( 'visibility', 'visible' );
	}

	MessageUpdate();
}

////////////////////////////////////////////////////////////////////////////////
// API呼び出しエラー
////////////////////////////////////////////////////////////////////////////////
function ApiError( res )
{
	if ( res.responseJSON )
	{
		MessageBox( 'status: ' + res.status + '<br>' + res.responseJSON.error );
	}
	else
	{
		MessageBox( 'status: ' + res.status + '<br>' + res.statusText );
	}
}

////////////////////////////////////////////////////////////////////////////////
// バックグラウンドとの通信用
////////////////////////////////////////////////////////////////////////////////
function SetBackgroundConnect()
{
	chrome.extension.onMessage.addListener( function( req, sender, sendres ) {
		return true;
	} );
}

////////////////////////////////////////////////////////////////////////////////
// バックグラウンドに要求送信
////////////////////////////////////////////////////////////////////////////////
function SendRequest( param, callback )
{
	chrome.extension.sendMessage( param, callback );
}

////////////////////////////////////////////////////////////////////////////////
// インポートファイル設定
////////////////////////////////////////////////////////////////////////////////
function SetImportFile( file )
{
	chrome.extension.getBackgroundPage().importFile = file;
}

////////////////////////////////////////////////////////////////////////////////
// ツールバーユーザ？
////////////////////////////////////////////////////////////////////////////////
function IsToolbarUser( user_id )
{
	var len = g_cmn.toolbar_user.length;

	for ( var i = 0 ; i < len ; i++ )
	{
		if ( g_cmn.toolbar_user[i].user_id == user_id && ( !g_cmn.toolbar_user[i].type || g_cmn.toolbar_user[i].type == 'user' ) )
		{
			return i;
		}
	}

	return -1;
}


////////////////////////////////////////////////////////////////////////////////
// ツールバーユーザの表示を更新
////////////////////////////////////////////////////////////////////////////////
function UpdateToolbarUser()
{
	var s = '';
	var len = g_cmn.toolbar_user.length;
	var assign;

	for ( var i = 0 ; i < len ; i++ )
	{
		if ( !g_cmn.toolbar_user[i].type )
		{
			g_cmn.toolbar_user[i].type = 'user';
		}

		assign = {
			avatar: g_cmn.toolbar_user[i].avatar,
			id: g_cmn.toolbar_user[i].id,
			instance: g_cmn.toolbar_user[i].instance,
			display_name: g_cmn.toolbar_user[i].display_name,
			account_id: g_cmn.toolbar_user[i].account_id,
			created_at: g_cmn.toolbar_user[i].created_at,
			type: g_cmn.toolbar_user[i].type,
			drag_id: GetUniqueID(),
		};

		s += OutputTPL( 'header_user', assign );
	}

	s += "<div class='dmy'></div>";

	$( '#head_users' ).html( s ).find( '> div' ).each( function() {
		if ( $( this ).hasClass( 'dmy' ) )
		{
			return true;
		}

		var display_name = $( this ).attr( 'display_name' );
		var account_id = $( this ).attr( 'account_id' );
		var id = $( this ).attr( 'id' );
		var instance = $( this ).attr( 'instance' );
		var type = $( this ).attr( 'type' );

		////////////////////////////////////////////////////////////
		// アイコンクリック時処理
		////////////////////////////////////////////////////////////
		$( this ).find( 'img' ).click( function( e ) {
			switch ( type )
			{
				case 'user':
					OpenUserTimeline( id, instance, account_id );
					break;
			}

			e.stopPropagation();
		} )
		////////////////////////////////////////////////////////////
		// 削除処理
		////////////////////////////////////////////////////////////
		.on( 'contextmenu', function( e ) {
			var len = g_cmn.toolbar_user.length;

			for ( var i = 0 ; i < len ; i++ )
			{
				if ( ( type == 'user' && g_cmn.toolbar_user[i].type == 'user' && user_id == g_cmn.toolbar_user[i].user_id ) )
				{
					g_cmn.toolbar_user.splice( i, 1 );
					UpdateToolbarUser();
					$( '#tooltip' ).hide();
					break;
				}
			}

			return false;
		} )
		.on( 'mouseenter mouseleave', function( e ) {
			if ( e.type == 'mouseenter' )
			{
				SetDraggable( $( this ), null, null );
			}
			else
			{
				$( '#tooltip' ).hide();
			}
		} );
	} );
}

////////////////////////////////////////////////////////////
// ツイートから画像のURLを抽出してサムネイル表示を呼び出す
////////////////////////////////////////////////////////////
function OpenThumbnail( item, stream )
{
	item.find( '.tweet_text' ).find( 'a' ).each( function() {
		// 画像URLなら
		if ( isImageURL( $( this ).attr( 'href' ) ) )
		{
			$( this ).trigger( 'mouseover', [ true, stream ] );
		}
	} );
}


////////////////////////////////////////////////////////////////////////////////
// セーブデータをテキスト化する
////////////////////////////////////////////////////////////////////////////////
function SaveDataText()
{
	var _g_cmn = {};
	var pi;

	for ( var i in g_cmn )
	{
		if ( i == 'notsave' )
		{
			continue;
		}
		else if ( i == 'account' )
		{
			_g_cmn[i] = {};

			for ( var j in g_cmn[i] )
			{
				_g_cmn[i][j] = {};

				for ( var k in g_cmn[i][j] )
				{
					if ( k == 'notsave' )
					{
						continue;
					}
					else
					{
						_g_cmn[i][j][k] = g_cmn[i][j][k];
					}
				}
			}
		}
		else if ( i == 'panel' )
		{
			_g_cmn[i] = new Array();

			for ( var j = 0, _len = g_cmn[i].length ; j < _len ; j++ )
			{
				_g_cmn[i].push( {} );

				for ( var k in g_cmn[i][j] )
				{
					if ( k != 'contents' && k != 'SetType' && k != 'SetTitle' && k != 'SetIcon' &&
						 k != 'SetParam' && k != 'SetContents' )
					{
						_g_cmn[i][j][k] = g_cmn[i][j][k];
					}
				}

				pi = $( '#' + g_cmn[i][j].id );

				_g_cmn[i][j].x = pi.position().left;
				_g_cmn[i][j].y = pi.position().top;
				_g_cmn[i][j].w = pi.width();
				_g_cmn[i][j].h = pi.height();
				_g_cmn[i][j].zindex = pi[0].style.zIndex;
			}
		}
		else
		{
			_g_cmn[i] = g_cmn[i];
		}
	}

	// 共通データをJSON形式でlocalStorageに保存
	var text = JSON.stringify( _g_cmn );
	text = encodeURIComponent( text );

	return text;
}


////////////////////////////////////////////////////////////////////////////////
// 画面リサイズ
////////////////////////////////////////////////////////////////////////////////
$( window ).on( 'resize', function( e ) {
	$( '#head' ).css( { width: $( window ).width() } );
} );


////////////////////////////////////////////////////////////////////////////////
// パネルリストの更新
////////////////////////////////////////////////////////////////////////////////
$( document ).on( 'panellist_changed', function( e ) {
	var items = new Array();

	var _p, _class, icon, badge;

	for ( var i = 0, _len = g_cmn.panel.length ; i < _len ; i++ )
	{
		_p = $( '#' + g_cmn.panel[i].id );
		_class = _p.find( 'span.titleicon' ).attr( 'class' );
		icon = '';
		badge = '';

		// アイコンあり
		if ( _class.match( /(icon-\S*)/ ) )
		{
			var _icon = RegExp.$1;

			if ( _p.find( 'span.titleicon' ).css( 'display' ) != 'none' )
			{
				icon = _icon;
			}
		}

		// 未読あり
		var _b = _p.find( '> div.titlebar' ).find( 'span.badge' );
		if ( _b )
		{
			badge = _b.text();
		}

		items.push( {
			icon: icon,
			title: g_cmn.panel[i].title,
			panel_id: g_cmn.panel[i].id,
			badge: badge
		} );
	}

	$( '#panellist' ).find( '> div.lists' ).html( OutputTPL( 'panellist', { items: items } ) )
	.find( 'span.badge' ).each( function() {
		if ( $( this ).text() != '' )
		{
			$( this ).show();
		}
		else
		{
			$( this ).hide();
		}
	} )
	.end().find( '> div' ).on( 'click', function() {
		var panel_id = $( this ).attr( 'panel_id' );
		var _p = $( '#' + panel_id );
		SetFront( _p );

		$( 'body' ).animate( { scrollTop: _p.position().top - $( '#head' ).outerHeight(),  scrollLeft: _p.position().left }, 200 );
	} );
} );


var g_message_data = null;

function SetLocaleFile()
{
	$.ajax( {
		url: '_locales/' + g_cmn.cmn_param.locale + '/messages.json',
		dataType: 'json',
		type: 'GET',
		async: false,
	} ).done( function( data ) {
		g_message_data = data;
	} ).fail( function( data ) {
		g_message_data = null;
	} );
}

////////////////////////////////////////////////////////////////////////////////
// 言語選択対応chrome.getMessageもどき
////////////////////////////////////////////////////////////////////////////////
function i18nGetMessage( id, options )
{
	if ( g_message_data != null )
	{
		if ( g_message_data[id] )
		{
			if ( g_message_data[id].placeholders )
			{
				var cnt = 0;
				var msg = g_message_data[id].message;

				for ( var p in g_message_data[id].placeholders )
				{
					if ( cnt < options.length )
					{
						msg = msg.replace( '$' + p + '$', options[cnt] );
					}
					else
					{
						msg = msg.replace( '$' + p + '$', '' );
					}

					cnt++;
				}

				return msg;
			}
			else
			{
				return g_message_data[id].message;
			}
		}
	}
	else
	{
		return '';
	}
}


////////////////////////////////////////////////////////////////////////////////
// Tootのタグを表示用に変換する
////////////////////////////////////////////////////////////////////////////////
function ConvertContent( content, json )
{
	var _jq;

	_jq = $( '<div>' + content + '</div>' );

	_jq.find( 'a' ).each( function( e ) {
		var anchor = $( this );

		// @user
		if ( anchor.hasClass( 'mention' ) && anchor.hasClass( 'u-url' ) )
		{
			$( this ).unwrap();
			var _user = $( '<span class="user anchor">@' + anchor.find( 'span' ).text() + '</span>' );
			
			for ( var i = 0, _len = json.mentions.length ; i < _len ; i++ )
			{
				if ( json.mentions[i].url == anchor.attr( 'href' ) )
				{
					_user.attr( 'id', json.mentions[i].id,
								'username', json.mentions[i].username,
								'acct', json.mentions[i].acct );
					break;
				}
			}

			if ( !_user.attr( 'id' ) )
			{
				console.log( '@user error' );
			}
			
			$( this ).replaceWith( _user );
		}
		// hashtag
		else if ( anchor.hasClass( 'mention' ) && anchor.hasClass( 'hashtag' ) )
		{
			$( this ).replaceWith( $( '<span class="hashtag anchor">#' + anchor.find( 'span' ).text() + '</span>' ) );
		}
		// url
		else
		{
			var ellipsis = '';
			var display_url = '';

			if ( anchor.find( 'span.invisible' ).length && anchor.find( 'span.ellipsis' ).length )
			{
				if ( anchor.find( 'span.invisible' ).length == 2 && anchor.find( 'span.invisible:last' ).text() != '' )
				{
					ellipsis = '…';
				}

				display_url = anchor.find( 'span.ellipsis' ).text();
			}
			else
			{
				display_url = anchor.text();
			}

			$( this ).replaceWith( $( '<a href="' + anchor.attr( 'href' ) + 
				'" rel="nofollow noopener" target="_blank" class="url anchor">' + 
				display_url + ellipsis + '</span></a>' ) );
		}

	} );

	return _jq.html();

}


////////////////////////////////////////////////////////////////////////////////
// acctからインスタンス名を取得する
////////////////////////////////////////////////////////////////////////////////
function GetInstanceFromAcct( acct, account_id ) {
	var _data = acct.split( /@/ );

	if ( _data.length <= 1 )
	{
		return g_cmn.account[account_id].instance;
	}
	else
	{
		return _data[_data.length - 1];
	}
}


////////////////////////////////////////////////////////////////////////////////
// 初期アイコンのURL変換
////////////////////////////////////////////////////////////////////////////////
function AvatarURLConvert( account, account_id )
{
	if ( account.avatar == "/avatars/original/missing.png" )
	{
		return 'https://' + GetInstanceFromAcct( account.acct, account_id ) + account.avatar;
	}
	else
	{
		return account.avatar;
	}
}

////////////////////////////////////////////////////////////////////////////////
// フレンドかチェック
////////////////////////////////////////////////////////////////////////////////
function IsFriend( account_id, user_id, user_instance )
{
/*
	var account = g_cmn.account[account_id];

	if ( account.notsave.friends == undefined )
	{
		return false;
	}

	for ( var i = 0, _len = account.notsave.friends.length ; i < _len ; i++ )
	{
		if ( user_id == account.notsave.friends[i] )
		{
			return true;
		}
	}

	return false;
*/
	return true; // 仮
}

////////////////////////////////////////////////////////////////////////////////
// フォロワーかチェック
////////////////////////////////////////////////////////////////////////////////
function IsFollower( account_id, user_id, user_instance )
{
/*
	var account = g_cmn.account[account_id];

	if ( account.notsave.followers == undefined )
	{
		return false;
	}

	for ( var i = 0, _len = account.notsave.followers.length ; i < _len ; i++ )
	{
		if ( user_id == account.notsave.followers[i] )
		{
			return true;
		}
	}

	return false;
*/
	return true; // 仮
}


////////////////////////////////////////////////////////////////////////////////
// 開始
////////////////////////////////////////////////////////////////////////////////
$( document ).ready( function() {
	Init();
} );