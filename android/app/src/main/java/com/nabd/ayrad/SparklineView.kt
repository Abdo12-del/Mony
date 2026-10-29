package com.nabd.ayrad

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import kotlin.math.max

internal class SparklineView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {
    private var prices: List<Double> = emptyList()
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFBEA1FF.toInt(); style = Paint.Style.STROKE; strokeWidth = dp(2f); strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE0D2FF.toInt(); style = Paint.Style.FILL }
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x22FFFFFF; strokeWidth = dp(1f) }
    private val emptyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF9BB0A2.toInt(); textSize = dp(12f); textAlign = Paint.Align.CENTER }

    fun setPrices(values: List<Double>) { prices = values.takeLast(36); invalidate() }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val left = dp(3f); val right = width - dp(3f); val top = dp(9f); val bottom = height - dp(10f)
        for (i in 0..2) {
            val y = top + (bottom - top) * i / 2f
            canvas.drawLine(left, y, right, y, gridPaint)
        }
        if (prices.size < 2) {
            canvas.drawText("سيظهر المسار بعد تسجيل فحصين ناجحين", width / 2f, height / 2f + dp(4f), emptyPaint)
            return
        }
        val min = prices.minOrNull() ?: return
        val highest = prices.maxOrNull() ?: return
        val spread = max(highest - min, max(highest * .01, 1.0))
        val points = prices.mapIndexed { index, price ->
            val x = left + index * (right - left) / (prices.size - 1)
            val y = bottom - ((price - min) / spread * (bottom - top)).toFloat()
            x to y
        }
        val line = Path().apply {
            points.forEachIndexed { index, point -> if (index == 0) moveTo(point.first, point.second) else lineTo(point.first, point.second) }
        }
        val area = Path(line).apply { lineTo(points.last().first, bottom); lineTo(points.first().first, bottom); close() }
        fillPaint.shader = LinearGradient(0f, top, 0f, bottom, 0x558B5CF6, 0x008B5CF6, Shader.TileMode.CLAMP)
        canvas.drawPath(area, fillPaint)
        fillPaint.shader = null
        canvas.drawPath(line, linePaint)
        val end = points.last()
        canvas.drawCircle(end.first, end.second, dp(4f), dotPaint)
    }

    private fun dp(value: Float) = value * resources.displayMetrics.density
}
