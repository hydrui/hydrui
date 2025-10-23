apiVersion: v1
kind: Service
metadata:
  name: {{ include "hydrui.fullname" . }}
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.labels" . | nindent 4 }}
  {{- with .Values.hydrui.service.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  type: {{ .Values.hydrui.service.type }}
  ports:
    - port: {{ .Values.hydrui.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "hydrui.selectorLabels" . | nindent 4 }}
