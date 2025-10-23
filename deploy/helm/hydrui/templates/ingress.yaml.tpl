{{- if .Values.hydrui.ingress.enabled -}}
{{- $fullName := include "hydrui.fullname" . -}}
{{- $svcPort := .Values.hydrui.service.port -}}
{{- $ingressClassName := .Values.hydrui.ingress.className -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ $fullName }}
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.labels" . | nindent 4 }}
  {{- with .Values.hydrui.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if $ingressClassName }}
  ingressClassName: {{ $ingressClassName }}
  {{- end }}
  {{- if .Values.hydrui.ingress.tls }}
  tls:
    {{- range .Values.hydrui.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.hydrui.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ $fullName }}
                port:
                  number: {{ $svcPort }}
          {{- end }}
    {{- end }}
{{- end }}
