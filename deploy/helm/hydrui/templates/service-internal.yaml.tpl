{{- if .Values.hydrui.internalService.enabled }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "hydrui.fullname" . }}-internal
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.labels" . | nindent 4 }}
    app.kubernetes.io/component: internal
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.hydrui.internalService.port }}
      targetPort: internal
      protocol: TCP
      name: internal
  selector:
    {{- include "hydrui.selectorLabels" . | nindent 4 }}
{{- end }}
