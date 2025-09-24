//go:build windows

package main

import (
	"bytes"
	"context"
	_ "embed"
	"errors"
	"fmt"
	"image/png"
	"log/slog"
	"net"
	"net/url"
	"os"
	"time"

	"github.com/hydrui/hydrui/internal/options"
	"github.com/hydrui/hydrui/internal/server"
	"github.com/hydrui/hydrui/internal/webdata"

	"github.com/lxn/walk"
	. "github.com/lxn/walk/declarative"
	"github.com/pkg/browser"
)

var uiOpts *options.Values
var uiLogBuffer bytes.Buffer
var uiLog = slog.New(slog.NewTextHandler(&uiLogBuffer, nil))
var notifyIcon *walk.NotifyIcon
var mainWin *walk.MainWindow

//go:embed hydrui.png
var hydruiIconPNG []byte
var hydruiIcon = mustDecodePNG(hydruiIconPNG)

var serviceManager *server.Manager

func startUI(ctx context.Context) bool {
	// Parse options early to determine if we should bail due to -nogui
	uiOpts = options.NewDefault()
	if err := uiOpts.ParseFlags(os.Args); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Error parsing command line flags.", slog.Any("error", err))
		return true
	}
	if uiOpts.NoGUI {
		return false
	}

	defer func() {
		if r := recover(); r != nil {
			walk.MsgBox(nil, tr("Panic!"), fmt.Sprintf(tr("Woah! A panic has occurred. Hydrui Server will now close. Panic message: %s"), r), walk.MsgBoxIconError)
			panic(r)
		}
	}()

	// Re-parse options, with the local configuration file loaded.
	// This allows configuration flags to override the config file.
	uiOpts = options.NewDefault()
	if err := uiOpts.LoadUserConfig(); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			uiLog.LogAttrs(ctx, slog.LevelWarn, "Failed to load user configuration file.", slog.Any("error", err))
		}
	}
	if err := uiOpts.ParseFlags(os.Args); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Error parsing command line flags.", slog.Any("error", err))
		return true
	}
	config, err := uiOpts.ServerConfig(ctx, uiLog)
	if err != nil {
		walk.MsgBox(nil, tr("Warning"), tr("Could not instantiate configuration, using default settings. See logs for more details."), walk.MsgBoxIconWarning)
		uiOpts = options.NewDefault()
		config, err = uiOpts.ServerConfig(ctx, uiLog)
		if err != nil {
			panic(err)
		}
	}

	serviceManager = server.NewManager(ctx, uiLog, webdata.Client)

	dummy, err := walk.NewMainWindow()
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Error creating background window.", slog.Any("error", err))
		return true
	}

	notifyIcon, err = walk.NewNotifyIcon(dummy)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Error creating notification icon.", slog.Any("error", err))
		return true
	}
	defer notifyIcon.Dispose()

	if err := notifyIcon.SetIcon(hydruiIcon); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Error setting notification icon.", slog.Any("error", err))
		return true
	}

	notifyIcon.MouseDown().Attach(func(x, y int, button walk.MouseButton) {
		if button != walk.LeftButton {
			return
		}
		if mainWin != nil && !mainWin.IsDisposed() {
			mainWin.Close()
			mainWin.Dispose()
		} else {
			runMainWindow(ctx)
		}
	})

	var currentAddress net.Addr
	var usingTLS bool
	openAction := walk.NewAction()
	_ = openAction.SetText(tr("&Open in Browser"))
	_ = openAction.Triggered().Attach(func() {
		if currentAddress == nil {
			walk.MsgBox(nil, tr("Warning"), tr("The server is not currently running."), walk.MsgBoxIconWarning)
			return
		}
		currentTCPAddress, ok := currentAddress.(*net.TCPAddr)
		if !ok {
			walk.MsgBox(nil, tr("Warning"), tr("The server is not listening on TCP."), walk.MsgBoxIconWarning)
			return
		}
		// If using the unspecified address, switch to a loopback address instead.
		localAddress := currentTCPAddress
		if localAddress.IP.Equal(net.IPv4zero) {
			localAddress.IP = net.IPv4(127, 0, 0, 1)
		} else if localAddress.IP.Equal(net.IPv6unspecified) {
			localAddress.IP = net.IPv6loopback
		}
		// Construct a URL.
		uri := url.URL{
			Scheme: "http",
			Host:   localAddress.String(),
		}
		if usingTLS {
			uri.Scheme = "https"
		}
		err := browser.OpenURL(uri.String())
		if err != nil {
			walk.MsgBox(nil, tr("Warning"), fmt.Sprintf(tr("Failed to open a web browser. Try opening %s in your browser."), uri), walk.MsgBoxIconWarning)
			return
		}
	})
	_ = notifyIcon.ContextMenu().Actions().Add(openAction)
	stopAction := walk.NewAction()
	_ = stopAction.SetText(tr("&Stop Server"))
	_ = stopAction.Triggered().Attach(func() {
		serviceManager.Stop()
	})
	_ = notifyIcon.ContextMenu().Actions().Add(stopAction)
	restartAction := walk.NewAction()
	_ = restartAction.SetText(tr("&Restart Server"))
	_ = restartAction.Triggered().Attach(func() {
		serviceManager.Configure(config)
	})
	_ = notifyIcon.ContextMenu().Actions().Add(restartAction)
	exitAction := walk.NewAction()
	_ = exitAction.SetText(tr("E&xit"))
	_ = exitAction.Triggered().Attach(func() {
		serviceManager.Close()
	})
	_ = notifyIcon.ContextMenu().Actions().Add(exitAction)

	notifyIcon.SetVisible(true)

	// Handle service status
	go func() {
		for status := range serviceManager.StatusChannel() {
			switch s := status.(type) {
			case server.StatusStarted:
				// Prioritize the TLS port.
				if s.AddressTLS != nil {
					currentAddress = s.AddressTLS
					usingTLS = true
				} else if s.Address != nil {
					currentAddress = s.Address
					usingTLS = false
				}
				_ = openAction.SetEnabled(true)
				_ = notifyIcon.ShowInfo(tr("Server Started"), fmt.Sprintf(tr("The server has started and is now listening on %s."), s.Address))
			case server.StatusStopped:
				currentAddress = nil
				_ = openAction.SetEnabled(false)
				_ = notifyIcon.ShowInfo(tr("Server Stopped"), tr("The server has stopped."))
			case server.StatusError:
				_ = notifyIcon.ShowInfo(tr("Server Error"), fmt.Sprintf(tr("A server error has occurred: %s."), s.Error))
			}
		}
		if mainWin != nil && !mainWin.IsDisposed() {
			mainWin.Close()
			mainWin.Dispose()
		}
		notifyIcon.Dispose()
		dummy.Close()
		os.Exit(0)
	}()
	serviceManager.Configure(config)
	dummy.Run()
	return true
}

func formLabel(label string) Widget {
	return TextLabel{
		Text:    label,
		MinSize: Size{Width: 100},
	}
}

func textField(label string, binding *string) Widget {
	var li *walk.LineEdit
	return Composite{
		Layout: HBox{MarginsZero: true},
		Children: []Widget{
			formLabel(label),
			LineEdit{
				AssignTo: &li,
				Text:     *binding,
				OnTextChanged: func() {
					*binding = li.Text()
				},
			},
		},
	}
}

func fileField(label string, filter string, binding *string) Widget {
	var li *walk.LineEdit
	var pb *walk.PushButton
	return Composite{
		Layout: HBox{MarginsZero: true},
		Children: []Widget{
			formLabel(label),
			LineEdit{
				AssignTo: &li,
				Text:     *binding,
				OnTextChanged: func() {
					*binding = li.Text()
				},
			},
			PushButton{
				AssignTo: &pb,
				Text:     tr("&Browse..."),
				OnClicked: func() {
					dlg := walk.FileDialog{
						Title:    fmt.Sprintf(tr("Select %s"), label),
						FilePath: *binding,
						Filter:   filter,
					}
					ok, err := dlg.ShowOpen(li.Form())
					if err != nil {
						walk.MsgBox(li.Form(), tr("Error"), fmt.Sprintf(tr("Error selecting file: %s"), err), walk.MsgBoxIconError)
						return
					}
					if ok {
						*binding = dlg.FilePath
						li.SetText(*binding)
					}
				},
			},
		},
	}
}

func checkboxField(label string, binding *bool) Widget {
	var cb *walk.CheckBox
	return Composite{
		Layout: HBox{MarginsZero: true},
		Children: []Widget{
			formLabel(""),
			CheckBox{
				AssignTo: &cb,
				Text:     label,
				Checked:  *binding,
				OnCheckedChanged: func() {
					*binding = cb.Checked()
				},
			},
			HSpacer{},
		},
	}
}

func runMainWindow(ctx context.Context) {
	newOpts := uiOpts.Clone()

	var logTE *walk.TextEdit
	logView := TextEdit{
		ReadOnly: true,
		Text:     uiLogBuffer.String(),
		AssignTo: &logTE,
	}

	t := time.NewTicker(time.Second / 5)
	defer t.Stop()
	go func() {
		for range t.C {
			if logTE != nil {
				logTE.SetText(uiLogBuffer.String())
			}
		}
	}()

	w := MainWindow{
		AssignTo: &mainWin,
		Title:    tr("Hydrui Server"),
		Size:     Size{Width: 500, Height: 500},
		Layout:   VBox{},
		Children: []Widget{
			TabWidget{
				Pages: []TabPage{
					{
						Title:  tr("Configure"),
						Layout: VBox{},
						Children: []Widget{
							GroupBox{
								Title:  tr("General"),
								Layout: VBox{},
								Children: []Widget{
									checkboxField(tr("Use Secure Cookies"), &newOpts.Secure),
								},
							},
							GroupBox{
								Title:  tr("Server Mode"),
								Layout: VBox{},
								Children: []Widget{
									checkboxField(tr("Use Server Mode"), &newOpts.ServerMode),
									textField(tr("Hydrus URL"), &newOpts.HydrusURL),
									textField(tr("Hydrus API key"), &newOpts.HydrusAPIKey),
									checkboxField(tr("Allow Bug Reports"), &newOpts.AllowBugReport),
									fileField(tr("Htpasswd File"), tr("Apache httpd-style .htpasswd Files (*.htpasswd,*.txt)|*.htpasswd;*.txt|All Files (*.*)|*.*"), &newOpts.HtpasswdFile),
								},
							},
							VSpacer{},
						},
					},
					{
						Title:  tr("Network"),
						Layout: VBox{},
						Children: []Widget{
							GroupBox{
								Title:  tr("Listeners"),
								Layout: VBox{},
								Children: []Widget{
									textField(tr("Listen Address (HTTP)"), &newOpts.Listen),
									textField(tr("Listen Address (HTTPS)"), &newOpts.ListenTLS),
								},
							},
							GroupBox{
								Title:  tr("TLS Configuration"),
								Layout: VBox{},
								Children: []Widget{
									fileField(tr("Certificate File"), tr("PEM-encoded Certificates (*.pem, *.crt)|*.pem;*.crt|All Files (*.*)|*.*"), &newOpts.TLSCertFile),
									fileField(tr("Key File"), tr("PEM-encoded Private Keys (*.pem, *.key)|*.pem;*.key|All Files (*.*)|*.*"), &newOpts.TLSKeyFile),
								},
							},
							GroupBox{
								Title:  tr("ACME/Let's Encrypt Configuration"),
								Layout: VBox{},
								Children: []Widget{
									TextLabel{Text: tr("Note: this overrides the TLS certificate settings above.")},
									checkboxField(tr("Use ACME for TLS"), &newOpts.UseACME),
									textField(tr("ACME E-mail"), &newOpts.ACMEEmail),
									textField(tr("ACME URL"), &newOpts.ACMEURL),
								},
							},
							VSpacer{},
						},
					},
					{Title: tr("Logs"), Layout: VBox{}, Children: []Widget{logView}},
				},
			},
			Composite{
				Layout: HBox{},
				Children: []Widget{
					HSpacer{},
					PushButton{
						Text: tr("&Quit"),
						OnClicked: func() {
							serviceManager.Close()
						},
					},
					PushButton{
						Text: tr("&Save"),
						OnClicked: func() {
							newConfig, err := newOpts.ServerConfig(ctx, uiLog)
							if err != nil {
								walk.MsgBox(mainWin, tr("Error"), fmt.Sprintf(tr("Configuration could not be instantiated: %s. See logs for more details."), err), walk.MsgBoxIconError)
								return
							}
							if err := newOpts.SaveUserConfig(); err != nil {
								walk.MsgBox(mainWin, tr("Warning"), fmt.Sprintf(tr("Configuration could not be saved: %s"), err), walk.MsgBoxIconWarning)
							}
							uiOpts = newOpts
							serviceManager.Configure(newConfig)
							mainWin.Close()
							mainWin.Dispose()
						},
					},
				},
			},
		},
	}

	w.Run()
}

func tr(source string) string {
	if translation := walk.TranslationFunc(); translation != nil {
		return translation(source)
	}
	return source
}

func mustDecodePNG(data []byte) *walk.Bitmap {
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		slog.LogAttrs(context.Background(), slog.LevelError, "Error decoding PNG image resource.", slog.Any("error", err))
	}
	bmp, err := walk.NewBitmapFromImageForDPI(img, 96*2)
	if err != nil {
		slog.LogAttrs(context.Background(), slog.LevelError, "Error creating bitmap from PNG image.", slog.Any("error", err))
	}
	return bmp
}
