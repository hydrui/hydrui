{{- if or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external") }}
{{- $needsSecret := false }}
{{- if and (not .Values.serverMode.hydrus.existingApiKeySecret) .Values.serverMode.hydrus.apiKey }}
{{- $needsSecret = true }}
{{- end }}
{{- if and (not .Values.serverMode.existingSessionSecret) (or .Values.serverMode.sessionSecret (not .Values.serverMode.existingSessionSecret)) }}
{{- $needsSecret = true }}
{{- end }}
{{- if and .Values.serverMode.auth.enabled (not .Values.serverMode.auth.htpasswd.existingSecret) .Values.serverMode.auth.htpasswd.content }}
{{- $needsSecret = true }}
{{- end }}
{{- if $needsSecret }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "hydrui.fullname" . }}-secrets
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.labels" . | nindent 4 }}
type: Opaque
stringData:
  {{- if and (not .Values.serverMode.hydrus.existingApiKeySecret) .Values.serverMode.hydrus.apiKey }}
  hydrus-api-key: {{ .Values.serverMode.hydrus.apiKey | quote }}
  {{- end }}
  {{- if not .Values.serverMode.existingSessionSecret }}
  jwt-secret: {{ .Values.serverMode.sessionSecret | default (include "hydrui.generateSecret" .) | quote }}
  {{- end }}
  {{- if and .Values.serverMode.auth.enabled (not .Values.serverMode.auth.htpasswd.existingSecret) .Values.serverMode.auth.htpasswd.content }}
  htpasswd: {{ .Values.serverMode.auth.htpasswd.content | quote }}
  {{- end }}
{{- end }}
{{- end }}
