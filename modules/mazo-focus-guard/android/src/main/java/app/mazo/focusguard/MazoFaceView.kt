package app.mazo.focusguard

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.min

/** Mazō's face, drawn natively with an angry expression (mirrors MazoCharacter). */
class MazoFaceView(context: Context) : View(context) {
  private val facePaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val featurePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#2A2622"); style = Paint.Style.FILL
  }
  private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#2A2622"); style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
  }
  private var shaker: ObjectAnimator? = null

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    val r = min(w, h) / 2f
    // clay → deep alert gradient
    facePaint.shader = RadialGradient(
      w * 0.4f, h * 0.35f, r * 1.2f,
      intArrayOf(Color.parseColor("#E0B49A"), Color.parseColor("#C98B6B"), Color.parseColor("#9B5E45")),
      floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP,
    )
  }

  override fun onDraw(canvas: Canvas) {
    val w = width.toFloat(); val h = height.toFloat()
    val cx = w / 2f; val cy = h / 2f
    val r = min(w, h) / 2f - 2f
    canvas.drawCircle(cx, cy, r, facePaint)

    val eyeDx = r * 0.34f
    val eyeY = cy - r * 0.08f
    val eyeR = r * 0.10f
    canvas.drawCircle(cx - eyeDx, eyeY, eyeR, featurePaint)
    canvas.drawCircle(cx + eyeDx, eyeY, eyeR, featurePaint)

    // angry eyebrows — angled inward
    strokePaint.strokeWidth = r * 0.07f
    val browY = eyeY - r * 0.26f
    canvas.drawLine(cx - eyeDx - r * 0.16f, browY - r * 0.04f, cx - eyeDx + r * 0.16f, browY + r * 0.12f, strokePaint)
    canvas.drawLine(cx + eyeDx + r * 0.16f, browY - r * 0.04f, cx + eyeDx - r * 0.16f, browY + r * 0.12f, strokePaint)

    // frown — downturned arc
    strokePaint.strokeWidth = r * 0.08f
    val path = Path().apply {
      val mY = cy + r * 0.42f
      moveTo(cx - r * 0.28f, mY)
      quadTo(cx, mY - r * 0.30f, cx + r * 0.28f, mY)
    }
    canvas.drawPath(path, strokePaint)
  }

  fun startShake() {
    if (shaker != null) return
    shaker = ObjectAnimator.ofFloat(this, "rotation", -4f, 4f).apply {
      duration = 110
      repeatMode = ValueAnimator.REVERSE
      repeatCount = ValueAnimator.INFINITE
      interpolator = LinearInterpolator()
      start()
    }
  }

  fun stopShake() {
    shaker?.cancel(); shaker = null; rotation = 0f
  }
}
