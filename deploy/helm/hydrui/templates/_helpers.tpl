{{- define "hydrui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "hydrui.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "hydrui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "hydrui.labels" -}}
helm.sh/chart: {{ include "hydrui.chart" . }}
{{ include "hydrui.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{- define "hydrui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "hydrui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/component: server
{{- end }}

{{- define "hydrui.hydrus.labels" -}}
helm.sh/chart: {{ include "hydrui.chart" . }}
{{ include "hydrui.hydrus.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{- define "hydrui.hydrus.selectorLabels" -}}
app.kubernetes.io/name: {{ include "hydrui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/component: hydrus
{{- end }}

{{- define "hydrui.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "hydrui.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "hydrui.image" -}}
{{- $tag := .Values.hydrui.image.tag | default .Chart.AppVersion -}}
{{- printf "%s:%s" .Values.hydrui.image.repository $tag -}}
{{- end }}

{{- define "hydrui.hydrus.image" -}}
{{- printf "%s:%s" .Values.hydrus.image.repository .Values.hydrus.image.tag -}}
{{- end }}

{{- define "hydrui.hydrusUrl" -}}
{{- if .Values.serverMode.hydrus.url -}}
{{- .Values.serverMode.hydrus.url -}}
{{- else if eq .Values.mode "server-bundled" -}}
{{- printf "http://%s-hydrus:45869" (include "hydrui.fullname" .) -}}
{{- else -}}
{{- fail "serverMode.hydrus.url must be set when using server-external mode" -}}
{{- end -}}
{{- end }}

{{- define "hydrui.hydrusApiKeySecretName" -}}
{{- if .Values.serverMode.hydrus.existingApiKeySecret -}}
{{- .Values.serverMode.hydrus.existingApiKeySecret -}}
{{- else -}}
{{- include "hydrui.fullname" . -}}-secrets
{{- end -}}
{{- end }}

{{- define "hydrui.hydrusApiKeySecretKey" -}}
{{- if .Values.serverMode.hydrus.existingApiKeySecret -}}
{{- .Values.serverMode.hydrus.existingApiKeySecretKey -}}
{{- else -}}
hydrus-api-key
{{- end -}}
{{- end }}

{{- define "hydrui.sessionSecretName" -}}
{{- if .Values.serverMode.existingSessionSecret -}}
{{- .Values.serverMode.existingSessionSecret -}}
{{- else -}}
{{- include "hydrui.fullname" . -}}-secrets
{{- end -}}
{{- end }}

{{- define "hydrui.sessionSecretKey" -}}
{{- if .Values.serverMode.existingSessionSecret -}}
{{- .Values.serverMode.existingSessionSecretKey -}}
{{- else -}}
jwt-secret
{{- end -}}
{{- end }}

{{- define "hydrui.htpasswdSecretName" -}}
{{- if .Values.serverMode.auth.htpasswd.existingSecret -}}
{{- .Values.serverMode.auth.htpasswd.existingSecret -}}
{{- else -}}
{{- include "hydrui.fullname" . -}}-secrets
{{- end -}}
{{- end }}

{{- define "hydrui.htpasswdSecretKey" -}}
{{- if .Values.serverMode.auth.htpasswd.existingSecret -}}
{{- .Values.serverMode.auth.htpasswd.existingSecretKey -}}
{{- else -}}
htpasswd
{{- end -}}
{{- end }}

{{- define "hydrui.namespace" -}}
{{- default .Release.Namespace .Values.namespaceOverride -}}
{{- end }}

{{- define "hydrui.generateSecret" -}}
{{- randAlphaNum 64 -}}
{{- end }}
